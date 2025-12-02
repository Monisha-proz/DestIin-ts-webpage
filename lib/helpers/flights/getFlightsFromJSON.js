import { promises as fs } from 'fs';
import path from 'path';

/**
 * Get flights from flight.json file based on search criteria
 * @param {Object} searchParams - Search parameters
 * @param {string} searchParams.departureAirportCode - Departure airport IATA code
 * @param {string} searchParams.arrivalAirportCode - Arrival airport IATA code
 * @param {Date} searchParams.departureDate - Departure date
 * @param {Date} searchParams.returnDate - Return date (optional)
 * @param {string} searchParams.tripType - Trip type (one_way, round_trip, multi_city)
 * @param {string} searchParams.flightClass - Flight class (economy, business, first)
 * @param {Object} searchParams.passengersObj - Passengers object {adults, children, infants}
 * @param {Object} searchParams.filters - Filter options
 * @returns {Promise<Array>} - Array of matching flights
 */
export async function getFlightsFromJSON(
  {
    departureAirportCode,
    arrivalAirportCode,
    departureDate,
    returnDate,
    tripType,
    flightClass,
    passengersObj,
    filters = {},
  },
  bookmarkedFlights = [],
  metaData = {}
) {
  try {
    // Read flight.json file
    const filePath = path.join(process.cwd(), 'public', 'flight.json');
    const fileContents = await fs.readFile(filePath, 'utf8');
    const flightData = JSON.parse(fileContents);

    if (!flightData.success || !flightData.data?.flights) {
      return [];
    }

    let flights = flightData.data.flights;

    // Filter flights based on search criteria
    flights = flights.filter(flight => {
      // Match departure and arrival airports
      if (flight.route.from.code !== departureAirportCode) {
        return false;
      }

      if (flight.route.to.code !== arrivalAirportCode) {
        return false;
      }

      // For static data, we'll show all flights for the route
      // In production, you would match the exact date here
      return true;
    });

    // Apply filters if provided
    if (filters.airlines && filters.airlines.length > 0) {
      flights = flights.filter(flight => 
        filters.airlines.includes(flight.airline.code)
      );
    }

    if (filters.priceRange && filters.priceRange.length === 2) {
      flights = flights.filter(flight => {
        const price = flight.price.total;
        return price >= filters.priceRange[0] && price <= filters.priceRange[1];
      });
    }

    // Transform flights to match expected format
    const transformedFlights = flights.map(flight => {
      // Check if bookmarked
      const isBookmarked = bookmarkedFlights?.some(
        bFlight => bFlight.flightId === flight.id
      ) || false;

      // Calculate total passengers
      const totalPassengers = 
        (passengersObj.adults || 0) + 
        (passengersObj.children || 0) + 
        (passengersObj.infants || 0);

      // Calculate total price based on passengers
      const totalPrice = flight.price.perAdult * (
        (passengersObj.adults || 0) + (passengersObj.children || 0)
      );

      return {
        _id: flight.id,
        flightCode: flight.flightCode,
        departureAirportId: {
          _id: flight.route.from.code,
          iataCode: flight.route.from.code,
          name: flight.route.from.city,
          city: flight.route.from.city,
        },
        arrivalAirportId: {
          _id: flight.route.to.code,
          iataCode: flight.route.to.code,
          name: flight.route.to.city,
          city: flight.route.to.city,
        },
        carrierInCharge: {
          _id: flight.airline.code,
          code: flight.airline.code,
          name: flight.airline.name,
          logo: flight.airline.logo,
        },
        date: new Date(flight.route.from.time).getTime(),
        totalDurationMinutes: flight.duration.minutes,
        status: flight.status,
        segmentIds: [{
          _id: flight.id + '_segment',
          from: {
            airport: {
              iataCode: flight.route.from.code,
              name: flight.route.from.city,
              city: flight.route.from.city,
            },
            scheduledDeparture: new Date(flight.route.from.time).toISOString(),
          },
          to: {
            airport: {
              iataCode: flight.route.to.code,
              name: flight.route.to.city,
              city: flight.route.to.city,
            },
            scheduledArrival: new Date(flight.route.to.time).toISOString(),
          },
          durationMinutes: flight.duration.minutes,
          stops: flight.stops.count,
          airplaneId: {
            model: 'Boeing 737', // Default model
          },
          airlineId: {
            _id: flight.airline.name,
            name: flight.airline.name,
            code: flight.airline.code,
            logo: flight.airline.logo,
          },
          fareDetails: {
            basePrice: {
              economy: {
                adult: flight.price.perAdult,
                child: flight.price.perAdult,
                infant: flight.price.perAdult * 0.1,
              },
              business: {
                adult: flight.price.perAdult * 2,
                child: flight.price.perAdult * 2,
                infant: flight.price.perAdult * 0.2,
              },
              first: {
                adult: flight.price.perAdult * 3,
                child: flight.price.perAdult * 3,
                infant: flight.price.perAdult * 0.3,
              },
            },
            taxes: {
              adult: { amount: 0 },
              child: { amount: 0 },
              infant: { amount: 0 },
            },
            serviceFee: {
              adult: { amount: 0 },
              child: { amount: 0 },
              infant: { amount: 0 },
            },
            discount: {
              adult: { amount: 0 },
              child: { amount: 0 },
              infant: { amount: 0 },
            },
          },
        }],
        ratingReviews: {
          totalReviews: Math.floor(Math.random() * 100) + 10,
          rating: (Math.random() * 2 + 3).toFixed(1), // Random rating between 3-5
        },
        isBookmarked,
        availableSeatsCount: [{
          segmentId: flight.id + '_segment',
          availableSeats: 50, // Default available seats
        }],
        fareBreakdowns: {
          baseFare: flight.price.perAdult * totalPassengers,
          taxes: 0,
          total: totalPrice,
        },
        tags: flight.tags || [],
        baggage: flight.baggage,
      };
    });

    return transformedFlights;
  } catch (error) {
    console.error('Error reading flights from JSON:', error);
    return [];
  }
}

/**
 * Get a single flight from flight.json file
 * @param {string} flightCode - Flight code (e.g. AI203)
 * @param {number} date - Flight date timestamp
 * @returns {Promise<Object>} - Flight object
 */
export async function getFlightFromJSON(flightCode, date) {
  try {
    // Read flight.json file
    const filePath = path.join(process.cwd(), 'public', 'flight.json');
    const fileContents = await fs.readFile(filePath, 'utf8');
    const flightData = JSON.parse(fileContents);

    if (!flightData.success || !flightData.data?.flights) {
      return null;
    }

    const flights = flightData.data.flights;
    
    // Find flight by code
    // In a real app, we would also match the date, but for static data we'll just match the code
    const flight = flights.find(f => f.flightCode === flightCode);

    if (!flight) {
      return null;
    }

    // Transform flight to match expected format (same as getFlightsFromJSON)
    return {
      _id: flight.id,
      flightCode: flight.flightCode,
      departureAirportId: {
        _id: flight.route.from.code,
        iataCode: flight.route.from.code,
        name: flight.route.from.city,
        city: flight.route.from.city,
      },
      arrivalAirportId: {
        _id: flight.route.to.code,
        iataCode: flight.route.to.code,
        name: flight.route.to.city,
        city: flight.route.to.city,
      },
      carrierInCharge: {
        _id: flight.airline.code,
        code: flight.airline.code,
        name: flight.airline.name,
        logo: flight.airline.logo,
      },
      date: new Date(flight.route.from.time).getTime(),
      totalDurationMinutes: flight.duration.minutes,
      status: flight.status,
      expireAt: new Date(flight.expireAt),
      segmentIds: [{
        _id: flight.id + '_segment',
        from: {
          airport: {
            iataCode: flight.route.from.code,
            name: flight.route.from.city,
            city: flight.route.from.city,
          },
          scheduledDeparture: new Date(flight.route.from.time).toISOString(),
        },
        to: {
          airport: {
            iataCode: flight.route.to.code,
            name: flight.route.to.city,
            city: flight.route.to.city,
          },
          scheduledArrival: new Date(flight.route.to.time).toISOString(),
        },
        durationMinutes: flight.duration.minutes,
        stops: flight.stops.count,
        airplaneId: {
          model: 'Boeing 737', // Default model
        },
        airlineId: {
          _id: flight.airline.name,
          name: flight.airline.name,
          code: flight.airline.code,
          logo: flight.airline.logo,
        },
        fareDetails: {
          basePrice: {
            economy: {
              adult: flight.price.perAdult,
              child: flight.price.perAdult,
              infant: flight.price.perAdult * 0.1,
            },
            business: {
              adult: flight.price.perAdult * 2,
              child: flight.price.perAdult * 2,
              infant: flight.price.perAdult * 0.2,
            },
            first: {
              adult: flight.price.perAdult * 3,
              child: flight.price.perAdult * 3,
              infant: flight.price.perAdult * 0.3,
            },
          },
          taxes: {
            adult: { amount: 0 },
            child: { amount: 0 },
            infant: { amount: 0 },
          },
          serviceFee: {
            adult: { amount: 0 },
            child: { amount: 0 },
            infant: { amount: 0 },
          },
          discount: {
            adult: { amount: 0 },
            child: { amount: 0 },
            infant: { amount: 0 },
          },
        },
      }],
      ratingReviews: {
        totalReviews: Math.floor(Math.random() * 100) + 10,
        rating: (Math.random() * 2 + 3).toFixed(1), // Random rating between 3-5
      },
      availableSeatsCount: [{
        segmentId: flight.id + '_segment',
        availableSeats: 50, // Default available seats
      }],
      tags: flight.tags || [],
      baggageAllowance: {
        checked: {
          weight: 15,
          unit: 'kg'
        },
        cabin: {
          weight: 7,
          unit: 'kg'
        }
      },
    };
  } catch (error) {
    console.error('Error reading flight from JSON:', error);
    return null;
  }
}
