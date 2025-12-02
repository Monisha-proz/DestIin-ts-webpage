
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

async function checkBookings() {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is missing");
    return;
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to DB");

    const bookings = await mongoose.connection.db.collection('flightbookings').find({}).toArray();
    console.log(`Found ${bookings.length} total bookings`);
    
    if (bookings.length > 0) {
        const booking = bookings[0];
        console.log("Sample Booking:", JSON.stringify(booking, null, 2));
        
        const itinerary = await mongoose.connection.db.collection('flightitineraries').findOne({ _id: booking.flightItineraryId });
        console.log("Related Itinerary:", JSON.stringify(itinerary, null, 2));
    } else {
        const itineraries = await mongoose.connection.db.collection('flightitineraries').find({}).limit(1).toArray();
        console.log(`Found ${itineraries.length} itineraries`);
        if (itineraries.length > 0) {
             console.log("Sample Itinerary:", JSON.stringify(itineraries[0], null, 2));
        }
    }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
  }
}

checkBookings();
