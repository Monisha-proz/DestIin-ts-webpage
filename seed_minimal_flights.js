const mongoose = require('mongoose');
const { ObjectId } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function seedMinimalFlightData() {
  try {
    console.log("Connecting to database...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected!");

    const db = mongoose.connection.db;

    // Create a simple airline
    console.log("Creating airline...");
    await db.collection('airlines').deleteMany({});
    const airline = {
      _id: "EK",
      iataCode: "EK",
      name: "Emirates",
      contact: {
        phone: "+971 4 400 0000",
        email: "contact@emirates.com",
        website: "https://www.emirates.com/"
      },
      airlinePolicy: {
        flightType: "International", // Required field
        cancellationPolicy: {
          gracePeriodHours: 24,
          cutoffHoursBeforeDeparture: 3,
          fareRules: {},
          allowVoucherInsteadOfRefund: true,
          notes: ""
        }
      }
    };
    await db.collection('airlines').insertOne(airline);
    console.log("✓ Airline created");

    // Create airports
    console.log("Creating airports...");
    await db.collection('airports').deleteMany({});
    const airports = [
      {
        _id: "DXB",
        iataCode: "DXB",
        name: "Dubai International Airport",
        city: "Dubai",
        country: "UAE",
        latitude: 25.2532,
        longitude: 55.3657,
        timezone: "Asia/Dubai"
      },
      {
        _id: "JFK",
        iataCode: "JFK",
        name: "John F. Kennedy International Airport",
        city: "New York",
        country: "USA",
        state: "NY",
        latitude: 40.6413,
        longitude: -73.7781,
        timezone: "America/New_York"
      }
    ];
    await db.collection('airports').insertMany(airports);
    console.log("✓ Airports created");

    // Create flight itineraries for the next 7 days
    console.log("Creating flight itineraries...");
    await db.collection('flightitineraries').deleteMany({});
    
    const itineraries = [];
    for (let day = 0; day < 7; day++) {
      const departureDate = new Date();
      departureDate.setDate(departureDate.getDate() + day + 1); // Tomorrow onwards
      departureDate.setHours(10, 0, 0, 0); // 10 AM departure

      const arrivalDate = new Date(departureDate);
      arrivalDate.setHours(departureDate.getHours() + 14); // 14 hour flight

      itineraries.push({
        flightCode: `EK${String(100 + day * 2).padStart(4, '0')}`,
        date: departureDate,
        carrierInCharge: "EK",
        departureAirportId: "DXB",
        arrivalAirportId: "JFK",
        segmentIds: [],
        totalDurationMinutes: 840, // 14 hours
        layovers: [],
        baggageAllowance: {
          currency: "USD",
          carryOn: {
            maxPieces: 1,
            maxWeight: { measurementUnit: "kg", value: 7 }
          },
          checked: {
            maxPieces: 2,
            maxWeight: { measurementUnit: "kg", value: 23 }
          }
        },
        status: "scheduled",
        expireAt: new Date(departureDate.getTime() - 30 * 60 * 1000) // Expires 30 min before departure
      });

      // Return flight
      const returnDeparture = new Date(departureDate);
      returnDeparture.setHours(20, 0, 0, 0); // 8 PM return

      const returnArrival = new Date(returnDeparture);
      returnArrival.setHours(returnDeparture.getHours() + 14);

      itineraries.push({
        flightCode: `EK${String(101 + day * 2).padStart(4, '0')}`,
        date: returnDeparture,
        carrierInCharge: "EK",
        departureAirportId: "JFK",
        arrivalAirportId: "DXB",
        segmentIds: [],
        totalDurationMinutes: 840,
        layovers: [],
        baggageAllowance: {
          currency: "USD",
          carryOn: {
            maxPieces: 1,
            maxWeight: { measurementUnit: "kg", value: 7 }
          },
          checked: {
            maxPieces: 2,
            maxWeight: { measurementUnit: "kg", value: 23 }
          }
        },
        status: "scheduled",
        expireAt: new Date(returnDeparture.getTime() - 30 * 60 * 1000)
      });
    }

    await db.collection('flightitineraries').insertMany(itineraries);
    console.log(`✓ Created ${itineraries.length} flight itineraries`);

    console.log("\n✅ Minimal flight data seeded successfully!");
    console.log("\nYou can now:");
    console.log("1. Search for flights from DXB to JFK");
    console.log("2. Create a booking");
    console.log("3. Make a payment");
    
    process.exit(0);

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

seedMinimalFlightData();
