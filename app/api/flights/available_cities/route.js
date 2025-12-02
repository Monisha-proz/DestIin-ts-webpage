import { promises as fs } from 'fs';
import path from 'path';

export async function GET(req) {
  const searchParams = Object.fromEntries(new URL(req.url).searchParams);
  const limit = searchParams?.limit || 50;
  const searchQuery = searchParams?.searchQuery;

  try {
    // Read cities.json file from public directory
    const filePath = path.join(process.cwd(), 'public', 'cities.json');
    const fileContents = await fs.readFile(filePath, 'utf8');
    const citiesData = JSON.parse(fileContents);

    if (!citiesData.success || !citiesData.data?.cities) {
      return Response.json(
        { success: false, message: 'Invalid cities data format' },
        { status: 500 }
      );
    }

    let cities = citiesData.data.cities;

    // If search query is provided, filter cities
    if (searchQuery && searchQuery.trim() !== '') {
      const searchLower = searchQuery.toLowerCase().trim();

      cities = cities.filter((city) => {
        return (
          city.code?.toLowerCase().includes(searchLower) ||
          city.name?.toLowerCase().includes(searchLower) ||
          city.city?.toLowerCase().includes(searchLower) ||
          city.country?.toLowerCase().includes(searchLower)
        );
      });
    }

    // Apply limit
    const limitedCities = cities.slice(0, parseInt(limit));

    // Transform to match the expected format (iataCode, name, city)
    const transformedCities = limitedCities.map(city => ({
      iataCode: city.code,
      name: `${city.name}, ${city.country}`,
      city: city.city,
      country: city.country,
      type: city.type
    }));

    return Response.json({
      success: true,
      message: 'Available cities fetched successfully',
      data: transformedCities,
    });
  } catch (error) {
    console.error('Error reading cities.json:', error);
    return Response.json(
      { success: false, message: 'Failed to fetch cities' },
      { status: 500 }
    );
  }
}
