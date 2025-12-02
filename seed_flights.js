const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

// Import seed data generation functions (using dynamic import for ES modules)
async function seedDatabase() {
  try {
    console.log("Connecting to database...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected!");

    // Import ES modules dynamically
    const { generateAirportsDB, generateAirplanesDB, generateAirlinesDB, generateAirlineFlightPricesDB, generateFlightsDB } = await import('./lib/db/generateForDB/flights/generateFlights.js');
    
    const primaryAirportData = await import('./lib/db/generateForDB/primaryData/airportsData.json', { assert: { type: 'json' } });
    const primaryAirplaneData = await import('./lib/db/generateForDB/primaryData/airplaneData.json', { assert: { type: 'json' } });
    const primaryAirlineData = await import('./lib/db/generateForDB/primaryData/airlinesData.json', { assert: { type: 'json' } });

    console.log("Generating data...");
    const airports = await generateAirportsDB(primaryAirportData.default);
    const { airplaneData: airplanes, seatData: seats } = await generateAirplanesDB(primaryAirplaneData.default);
    const airlines = await generateAirlinesDB(primaryAirlineData.default);
    const airlineFlightPrices = await generateAirlineFlightPricesDB(primaryAirlineData.default);
    const flights = await generateFlightsDB(10, airports, airplanes, airlines, airlineFlightPrices);

    let flightItineraries = [];
    let flightSegments = [];
    let flightSeats = [];

    for (const f of flights) {
      flightItineraries = flightItineraries.concat(f.flightItinerary);
      flightSegments = flightSegments.concat(f.flightSegments);
      flightSeats = flightSeats.concat(f.flightSeats);
    }

    console.log(`Generated ${airports.length} airports`);
    console.log(`Generated ${airplanes.length} airplanes`);
    console.log(`Generated ${airlines.length} airlines`);
    console.log(`Generated ${flightItineraries.length} flight itineraries`);

    // Save to database
    console.log("Saving to database...");
    
    const collections = [
      { name: 'airports', data: airports },
      { name: 'airplanes', data: airplanes },
      { name: 'airlines', data: airlines },
      { name: 'airlineflightprices', data: airlineFlightPrices },
      { name: 'flightitineraries', data: flightItineraries },
      { name: 'flightsegments', data: flightSegments },
      { name: 'flightseats', data: flightSeats }
    ];

    for (const { name, data } of collections) {
      console.log(`Clearing ${name}...`);
      await mongoose.connection.db.collection(name).deleteMany({});
      
      if (data.length > 0) {
        console.log(`Inserting ${data.length} ${name}...`);
        await mongoose.connection.db.collection(name).insertMany(data);
        console.log(`✓ ${name} saved`);
      }
    }

    console.log("\n✅ Database seeded successfully!");
    process.exit(0);

  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  }
}

seedDatabase();
