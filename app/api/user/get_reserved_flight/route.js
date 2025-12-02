import { auth } from "@/lib/auth";
import { cancelBooking, isSeatTakenByElse } from "@/lib/services/flights";
import { getOneDoc } from "@/lib/db/getOperationDB";
import { strToObjectId } from "@/lib/db/utilsDB";
export async function POST(req) {
  const body = await req.json();
  const session = await auth();
  if (!session?.user) {
    return Response.json(
      { success: false, message: "Unauthenticated" },
      { status: 401 },
    );
  }

  try {
    // Try to get flight from JSON first
    const { getFlightFromJSON } = await import("@/lib/helpers/flights/getFlightsFromJSON");
    let flightItinerary = await getFlightFromJSON(body.flightNumber, +body.flightDateTimestamp);

    if (!flightItinerary) {
      flightItinerary = await getOneDoc(
        "FlightItinerary",
        {
          flightCode: body.flightNumber,
          date: new Date(+body.flightDateTimestamp),
        },
        ["flight"],
        0,
      );
    }

    let reservedFlight = {};
    if (flightItinerary && flightItinerary._id) {
       reservedFlight = await getOneDoc(
        "FlightBooking",
        {
          flightItineraryId: strToObjectId(flightItinerary._id),
          userId: strToObjectId(session.user.id),
          paymentStatus: "pending",
          ticketStatus: "pending",
        },
        ["userFlightBooking"],
        0,
      );
    }


    // Static Data Mode: If flight exists (from JSON) but no booking in DB, return mock booking
    if (Object.keys(reservedFlight).length === 0) {
      if (flightItinerary) {
        // Generate a PNR code for the mock booking
        const pnrCode = 'MOCK' + Math.random().toString(36).substring(2, 8).toUpperCase();
        
        // Calculate total fare from flight data
        const totalFare = flightItinerary.price || 100;
        const currency = flightItinerary.currency || 'USD';
        
        // Create mock selected seats array (required by payment intent)
        const mockSelectedSeats = [{
          passengerId: 'mock_passenger_' + Date.now(),
          seatId: {
            _id: 'mock_seat_' + Date.now(),
            seatNumber: '12A',
            class: 'economy'
          }
        }];
        
        return Response.json({
          success: true,
          data: {
            _id: "mock_booking_id_" + Date.now(),
            pnrCode: pnrCode,
            guaranteedReservationUntil: new Date(Date.now() + 10 * 60 * 1000),
            paymentStatus: "pending",
            ticketStatus: "pending",
            totalFare: totalFare,
            currency: currency,
            selectedSeats: mockSelectedSeats,
            flightItineraryId: flightItinerary,
            userId: session.user.id,
            passengers: [],
            fareBreakdown: {
              baseFare: totalFare * 0.85,
              taxes: totalFare * 0.15
            }
          },
          message: "Flight booking fetched successfully (mock)",
        });
      }
    
      return Response.json({
        success: false,
        message: "Flight not reserved or got canceled",
      });
    }


    if (
      Object.keys(flightItinerary).length &&
      new Date(flightItinerary.date) < new Date()
    ) {
      await cancelBooking(reservedFlight.pnrCode, {
        reason: "Flight expired",
        canceledAt: new Date(),
        canceledBy: "system",
      });
      return Response.json({
        success: false,
        message: "Flight booking has expired as the flight date has passed",
      });
    }

    const isSeatTakenPromise = reservedFlight.selectedSeats.map(async (el) => {
      const isTaken = await isSeatTakenByElse(el.seatId._id, el.passengerId);
      return isTaken;
    });

    const isTaken = (await Promise.all(isSeatTakenPromise)).some(Boolean);
    if (isTaken) {
      await cancelBooking(reservedFlight.pnrCode, {
        reason: "Seat taken by another passenger due to expired reservation",
        canceledAt: new Date(),
        canceledBy: "system",
      });
      return Response.json({
        success: false,
        message: `Seat is already taken by another passenger, thus the booking has been canceled`,
      });
    }

    return Response.json({
      success: true,
      data: reservedFlight,
      message: "Flight booking fetched successfully",
    });
  } catch (error) {
    return Response.json(
      { success: false, message: error.message },
      { status: 500 },
    );
  }
}
