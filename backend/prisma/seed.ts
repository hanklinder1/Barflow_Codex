import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const bars = [
  {
    id: "tts",
    name: "Tiger Town Tavern",
    latitude: 34.68375,
    longitude: -82.83845,
    tagline: "The classic Clemson night-out spot.",
    vibeTags: "Cheap,Game Day,Dance",
    musicStyle: "Top 40",
    lineLevel: "Medium",
    bestNights: "Thursday,Saturday"
  },
  {
    id: "backstreets",
    name: "Backstreets Pub & Deli",
    latitude: 34.68302,
    longitude: -82.83889,
    tagline: "Loud, social, and always moving.",
    vibeTags: "Cheap,Dance,College",
    musicStyle: "EDM/Hip-Hop",
    lineLevel: "High",
    bestNights: "Wednesday,Friday"
  },
  {
    id: "studyhall",
    name: "Study Hall",
    latitude: 34.68322,
    longitude: -82.83775,
    tagline: "Big groups and easy meetups.",
    vibeTags: "Game Day,Chill,Groups",
    musicStyle: "Mixed",
    lineLevel: "Medium",
    bestNights: "Friday,Saturday"
  },
  {
    id: "loosechange",
    name: "Loose Change",
    latitude: 34.68257,
    longitude: -82.83824,
    tagline: "Dive-y hangout with late energy.",
    vibeTags: "Cheap,Chill,Late",
    musicStyle: "Rock/Mixed",
    lineLevel: "Low",
    bestNights: "Thursday,Saturday"
  },
  {
    id: "itsurweiner",
    name: "Itsurweiner",
    latitude: 34.68284,
    longitude: -82.83742,
    tagline: "Casual stop for quick regrouping.",
    vibeTags: "Chill,Food,Cheap",
    musicStyle: "Mixed",
    lineLevel: "Low",
    bestNights: "Tuesday,Thursday"
  }
];

async function main() {
  for (const bar of bars) {
    await prisma.bar.upsert({
      where: { id: bar.id },
      update: bar,
      create: bar
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Seed complete");
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
