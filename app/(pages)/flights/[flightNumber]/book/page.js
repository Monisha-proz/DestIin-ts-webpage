import { BreadcrumbUI } from "@/components/local-ui/breadcrumb";
import { AuthenticationCard } from "@/components/AuthenticationCard";
import { auth } from "@/lib/auth";
import { parseFlightSearchParams } from "@/lib/utils";

import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getUserDetails } from "@/lib/services/user";
import SessionTimeoutCountdown from "@/components/local-ui/SessionTimeoutCountdown";
import { getFlightFromJSON } from "@/lib/helpers/flights/getFlightsFromJSON";
import BookingSteps from "@/components/pages/flights.book/BookingSteps";
import InfoPage from "@/components/InfoPage";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

export default async function FlightBookPage({ params, searchParams }) {
  const session = await auth();
  const loggedIn = !!session?.user;
  const searchStateCookie = cookies().get("flightSearchState")?.value || "{}";
  const parsedSearchState = parseFlightSearchParams(searchStateCookie);
  const timeZone = cookies().get("timeZone")?.value || "UTC";
  const flightClass = parsedSearchState.class;
  const metaData = {
    timeZone,
    flightClass,
    isBookmarked: false,
    userEmail: session?.user?.email,
  };

  if (!loggedIn) {
    return (
      <main className="mx-auto my-10 w-[90%] text-secondary">
        <AuthenticationCard className={"mt-4"} />;
      </main>
    );
  }

  const p = params.flightNumber.split("_");
  const flightCode = p[0];
  const date = !isNaN(+p[1]) ? +p[1] : p[1];

  const flight = await getFlightFromJSON(flightCode, date);

  if (!flight) {
    notFound();
  }

  let hasPendingBooking = false;
  let bookingId = null;
  
  // Static data mode: skip pending booking checks from DB
  if (loggedIn) {
    try {
      const userDetails = await getUserDetails(session.user.id, 0);
      metaData.isBookmarked = userDetails?.flights?.bookmarked?.some((el) => {
        return el.flightId?._id === flight._id;
      }) || false;
    } catch (e) {
      console.log("Error fetching user details:", e);
    }
  }

  const isFlightExpired = flight.expireAt < new Date();
  let isSeatsAvailable = true;

  for (const segment of flight.segmentIds) {
    // For static data, we use the availableSeatsCount from the flight object
    const segmentSeats = flight.availableSeatsCount.find(s => s.segmentId === segment._id);
    const availableSeats = segmentSeats ? segmentSeats.availableSeats : 0;
    
    if (availableSeats === 0) {
      isSeatsAvailable = false;
      break;
    }
  }

  if (isFlightExpired && !hasPendingBooking) {
    return (
      <InfoPage
        whatHappened={"Flight Expired"}
        explanation={
          "The flight you are trying to book has expired. Please try to book another flight."
        }
        navigateTo={{ path: "/flights", title: "Search Flights" }}
      />
    );
  }

  if (!isSeatsAvailable && !hasPendingBooking) {
    return (
      <InfoPage
        whatHappened={"No Seats Available"}
        explanation={
          "There are no more seats available for this flight. Please try to book another flight."
        }
        navigateTo={{ path: "/flights", title: "Search Flights" }}
      />
    );
  }

  return (
    <>
      <main className="mx-auto my-10 w-[90%] text-secondary">
        <BreadcrumbUI />
        <SessionTimeoutCountdown
          redirectionLink="/flights"
          className={"my-4 rounded-md"}
        />

        {hasPendingBooking && bookingId && (
          <div className="mb-6 rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm font-medium text-gray-800 shadow-md">
            You have a pending booking for this flight. Whether cancel that or
            confirm that to book this flight again.
            <br />
            <Link
              target="_blank"
              className="font-bold text-yellow-800 underline"
              href={`/user/my_bookings/flights/${bookingId}`}
            >
              See that booking{" "}
              <ExternalLink
                width={12}
                height={12}
                className="inline stroke-[3px] align-middle"
              />
            </Link>
          </div>
        )}

        <BookingSteps
          flight={flight}
          metaData={metaData}
          searchStateObj={parsedSearchState}
        />
      </main>
    </>
  );
}
