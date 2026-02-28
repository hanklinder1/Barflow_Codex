import dotenv from "dotenv";

dotenv.config();

function normalizeOrigin(origin: string) {
  return origin.replace(/\/+$/, "");
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret",
  clientOrigin: normalizeOrigin(process.env.CLIENT_ORIGIN ?? "http://localhost:5173"),
  adminDebugKey: process.env.ADMIN_DEBUG_KEY ?? "",
  downtownCenter: {
    lat: 34.6831,
    lng: -82.8382,
    radiusMeters: 1200
  },
  autoCheckInRadiusMeters: 120
};
