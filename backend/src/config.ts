import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret",
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  downtownCenter: {
    lat: 34.6831,
    lng: -82.8382,
    radiusMeters: 1200
  },
  autoCheckInRadiusMeters: 120
};
