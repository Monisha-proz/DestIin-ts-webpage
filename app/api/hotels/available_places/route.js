import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const limit = Number(searchParams.get("limit")) || 10;
    const searchQuery =
      searchParams.get("searchQuery")?.trim().toLowerCase() || "";

    const Places = [
      { city: "Chennai", country: "IN", code: "553248633981715834" },
      { city: "Delhi", country: "IN", code: "180000" },
      { city: "Bengaluru", country: "IN", code: "553248633981715864" },
    ];

    // ✅ IMPORT DB MODEL AT RUNTIME ONLY
    const { Hotel } = await import("@/lib/db/models");

    // Helper
    const filterPlaces = (query) => {
      if (!query) return Places;
      return Places.filter(
        (p) =>
          p.city.toLowerCase().includes(query) ||
          p.country.toLowerCase().includes(query)
      );
    };

    // ---------------- NO SEARCH ----------------
    if (!searchQuery) {
      const hotell = await Hotel.find({})
        .limit(limit)
        .select("address -_id");

      const hotels =
        hotell.length === 0
          ? Places
          : hotell.map((hotel) => ({
              city: hotel.address.city,
              country: hotel.address.country,
              code: hotel.address.code,
            }));

      return NextResponse.json({
        success: true,
        message: "Available places fetched successfully",
        data: hotels.map((h) => ({
          city: h.city,
          country: h.country,
          type: "place",
          code: h.code,
        })),
      });
    }

    // ---------------- SEARCH ----------------
    const safeRegex = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const hotels = await Hotel.find({
      $or: [
        {
          $expr: {
            $regexMatch: {
              input: { $toLower: "$address.city" },
              regex: safeRegex,
            },
          },
        },
        {
          $expr: {
            $regexMatch: {
              input: { $toLower: "$address.country" },
              regex: safeRegex,
            },
          },
        },
      ],
    })
      .limit(limit)
      .select("address -_id");

    const hotelResults = hotels.map((hotel) => ({
      city: hotel.address.city,
      country: hotel.address.country,
      type: "place",
    }));

    const placeResults = filterPlaces(searchQuery).map((p) => ({
      city: p.city,
      country: p.country,
      type: "place",
      code: p.code,
    }));

    const unique = {};
    [...hotelResults, ...placeResults].forEach((item) => {
      unique[`${item.city}-${item.country}`] = item;
    });

    return NextResponse.json({
      success: true,
      message: "Available places fetched successfully",
      data: Object.values(unique),
    });
  } catch (err) {
    console.error("Available places API error:", err);
    return NextResponse.json(
      { success: false, message: "Error getting available places" },
      { status: 500 }
    );
  }
}
