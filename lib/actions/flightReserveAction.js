"use server";

import { cookies } from "next/headers";
import { auth } from "../auth";
import { getOneDoc } from "../db/getOperationDB";
import { nanoid, parseFlightSearchParams } from "../utils";
import { createOneDoc } from "../db/createOperationDB";
import validatePassengersDetailsAction from "./validatePassengerDetailsAction";
import validatePassengersPreferencesAction from "./validatePassengersPreferencesAction";
import createPassengersAction from "./createPassengersAction";
import { assignSeatsToFlightBooking } from "../services/flights";
import { multiSegmentCombinedFareBreakDown } from "../db/schema/flightItineraries";
import mongoose from "mongoose";
import { strToObjectId } from "../db/utilsDB";
import { revalidateTag } from "next/cache";

export async function flightReserveAction(prevState, formData) {
  const session = await auth();
  const loggedIn = !!session?.user;
  if (!loggedIn) return { success: false, message: "Please login first" };

  const data = Object.fromEntries(formData);
  let passengersDetails = JSON.parse(data.passengersDetails);
  let passengersPreferences = JSON.parse(data.passengersPreferences);
  const metaData = JSON.parse(data.metaData);

  // Try to get flight from JSON first
  const { getFlightFromJSON } = await import("../helpers/flights/getFlightsFromJSON");
  let flightItinerary = await getFlightFromJSON(metaData.flightNumber, new Date(metaData.date).getTime());

  // If not found in JSON, try DB (fallback)
  if (!flightItinerary) {
    flightItinerary = await getOneDoc(
      "FlightItinerary",
      {
        flightCode: metaData.flightNumber,
        date: new Date(metaData.date),
      },
      ["flight"],
      0,
    );
  }

  if (!flightItinerary || (Object.keys(flightItinerary).length === 0 && !flightItinerary._id))
    return { success: false, message: "Flight not found" };

  // Static Data Mode: Bypass DB checks and creation
  // We'll just return success to allow the UI to proceed to payment
  // In a real app, we would save to DB here.
  
  // Mock success for static demo
  return { success: true, message: "Reservation created successfully" };
}
