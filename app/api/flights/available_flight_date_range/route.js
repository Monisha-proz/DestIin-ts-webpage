import { promises as fs } from 'fs';
import path from 'path';

export async function GET(req) {
  try {
    // Read flight.json file from public directory
    const filePath = path.join(process.cwd(), 'public', 'flight.json');
    const fileContents = await fs.readFile(filePath, 'utf8');
    const flightData = JSON.parse(fileContents);

    if (!flightData.success || !flightData.data?.flights) {
      return Response.json({
        success: false,
        message: 'Invalid flight data format',
      });
    }

    const flights = flightData.data.flights;

    if (flights.length === 0) {
      return Response.json({
        success: false,
        message: 'No flights available',
      });
    }

    // Find the earliest and latest expireAt dates
    let earliestDate = new Date(flights[0].expireAt).getTime();
    let latestDate = new Date(flights[0].expireAt).getTime();
    const now = Date.now();

    flights.forEach(flight => {
      const expireAt = new Date(flight.expireAt).getTime();
      
      // Only consider flights that haven't expired
      if (expireAt >= now) {
        if (expireAt < earliestDate) earliestDate = expireAt;
        if (expireAt > latestDate) latestDate = expireAt;
      }
    });

    // Also check the route times for more accurate date range
    let earliestFlightDate = new Date(flights[0].route.from.time).getTime();
    let latestFlightDate = new Date(flights[0].route.from.time).getTime();

    flights.forEach(flight => {
      const departureTime = new Date(flight.route.from.time).getTime();
      const expireAt = new Date(flight.expireAt).getTime();
      
      // Only consider flights that haven't expired
      if (expireAt >= now) {
        if (departureTime < earliestFlightDate) earliestFlightDate = departureTime;
        if (departureTime > latestFlightDate) latestFlightDate = departureTime;
      }
    });

    return Response.json({
      success: true,
      message: 'Success',
      data: {
        from: earliestFlightDate || Date.now(),
        to: latestFlightDate || Date.now() + (365 * 24 * 60 * 60 * 1000), // 1 year from now as fallback
      },
    });
  } catch (error) {
    console.error('Error reading flight.json:', error);
    return Response.json(
      {
        success: false,
        message: 'Failed to get flight date range',
      },
      { status: 500 }
    );
  }
}

export function POST() {}

