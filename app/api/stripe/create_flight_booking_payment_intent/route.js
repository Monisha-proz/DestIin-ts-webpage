import { auth } from "@/lib/auth";
import { cancelBooking, isSeatTakenByElse } from "@/lib/services/flights";
import { getUserDetails } from "@/lib/services/user";
import { getOneDoc } from "@/lib/db/getOperationDB";
import { updateOneDoc } from "@/lib/db/updateOperationDB";
import { strToObjectId } from "@/lib/db/utilsDB";
import initStripe, {
  createUniqueCustomer,
} from "@/lib/paymentIntegration/stripe";
import { usdToCents } from "@/lib/utils";
import { revalidateTag } from "next/cache";
import { z } from "zod";

export async function POST(req) {
  const session = await auth();
  if (!session?.user)
    return Response.json(
      { success: false, message: "Unauthenticated" },
      { status: 401 },
    );

  /**
   * @typedef {Object} PaymentIntentBody
   * @property {string} paymentMethodId - ID of the payment method to use
   * @property {string} flightBookingId - Flight booking ID
   * @property {boolean} shouldSavePaymentMethod - Whether to save the payment method for future use
   */

  /**
   * @type {PaymentIntentBody}
   */
  const body = await req.json();
  const validationBody = validateReqBody(body);
  if (validationBody.success === false) {
    return Response.json({
      success: false,
      message: "Invalid types in body props or required property is absent",
    });
  }
  try {
    const user = await getUserDetails(session.user.id, 0);
    let customerId = user?.customerId;
    if (!customerId) {
      const customer = await createUniqueCustomer(
        {
          name: user.firstName + " " + user.lastName,
          email: user.email,
        },
        null,
        ["email"],
      );
      customerId = customer.id;
      await updateOneDoc("User", { _id: user._id }, { customerId });
      revalidateTag("userDetails");
    }

    // Get booking data from the get_reserved_flight API which handles both DB and mock bookings
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const bookingResponse = await fetch(`${baseUrl}/api/user/get_reserved_flight`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': req.headers.get('cookie') || ''
      },
      body: JSON.stringify({
        flightNumber: body.flightNumber,
        flightDateTimestamp: body.flightDateTimestamp
      })
    });

    if (!bookingResponse.ok) {
      return Response.json({
        success: false,
        message: "Failed to fetch booking details",
      }, { status: 500 });
    }

    const bookingResult = await bookingResponse.json();
    
    if (!bookingResult.success || !bookingResult.data) {
      return Response.json({
        success: false,
        message: bookingResult.message || "There is no pending flight booking",
      });
    }

    const bookingData = bookingResult.data;
    const isMockBooking = bookingData._id?.toString().startsWith("mock_booking_id_");

    // Skip seat validation for mock bookings
    if (!isMockBooking) {
      const isSeatTakenPromise = bookingData.selectedSeats.map(async (el) => {
        return await isSeatTakenByElse(el.seatId._id, el.passengerId);
      });

      const isTaken = (await Promise.all(isSeatTakenPromise)).some(Boolean);

      if (isTaken) {
        const cancellationData = {
          reason: "Seat taken by another passenger due to expired reservation",
          canceledAt: new Date(),
          canceledBy: "system",
        };

        await cancelBooking(bookingData.pnrCode, cancellationData);
        return Response.json({
          success: false,
          message:
            "Your seat is taken by someone else, thus we have canceled your booking",
        });
      }
    }

    const stripe = initStripe();
    let idempotencyKey = bookingData.pnrCode;
    const price = parseInt(usdToCents(+bookingData.totalFare));
    const paymentIntents = await stripe.paymentIntents.create(
      {
        amount: price,
        currency: bookingData.currency || "usd",
        payment_method: body.paymentMethodId || undefined,
        customer: customerId,
        automatic_payment_methods: {
          enabled: true,
        },
        receipt_email: user.email,
        metadata: {
          type: "flightBooking",
          flightItineraryId: bookingData.flightItineraryId?._id?.toString() || 'mock_flight',
          flightBookingId: bookingData._id.toString(),
          pnrCode: bookingData.pnrCode,
          userId: user._id.toString(),
          userEmail: user.email,
          isMockBooking: isMockBooking.toString(),
        },
      },
      { idempotencyKey },
    );
    const getP = await stripe.paymentIntents.retrieve(paymentIntents.id, {});
    return Response.json(
      {
        success: true,
        message: "Success",
        data: {
          paymentIntents,
          paymentStatus: getP.status,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.log(error);
    const resObj = {
      success: false,
      message: "Something went wrong",
    };
    if (error.type === "StripeConnectionError")
      resObj.message = "Unable to connect";

    return Response.json(resObj, { status: 500 });
  }
}

function validateReqBody(data) {
  const schema = z
    .object({
      paymentMethodId: z.string().optional(),
      flightNumber: z.string(),
      flightDateTimestamp: z.union([z.string(), z.number()]),
      shouldSavePaymentMethod: z.boolean().optional(),
    })
    .safeParse(data);

  return schema;
}
