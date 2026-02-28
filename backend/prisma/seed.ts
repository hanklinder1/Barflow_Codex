import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const bars = [
  {
    id: "tds",
    name: "TD's",
    latitude: 34.682314,
    longitude: -82.837301,
    tagline: "Clemson downtown staple.",
    vibeTags: "College,Social",
    musicStyle: "Mixed",
    lineLevel: "Medium",
    bestNights: "Thursday,Friday,Saturday"
  },
  {
    id: "backstreets",
    name: "Backstreets",
    latitude: 34.6836255716976,
    longitude: -82.83666011989295,
    tagline: "Fast-paced downtown spot.",
    vibeTags: "College,Dance,Social",
    musicStyle: "Mixed",
    lineLevel: "High",
    bestNights: "Thursday,Friday,Saturday"
  },
  {
    id: "studyhall",
    name: "Study Hall",
    latitude: 34.683367925520535,
    longitude: -82.83780545981314,
    tagline: "Group-friendly meetup bar.",
    vibeTags: "Groups,College,Social",
    musicStyle: "Mixed",
    lineLevel: "Medium",
    bestNights: "Thursday,Friday,Saturday"
  },
  {
    id: "loosechange",
    name: "Loose Change",
    latitude: 34.68261587100437,
    longitude: -82.8374952770089,
    tagline: "Late-night Clemson hangout.",
    vibeTags: "Late,College,Social",
    musicStyle: "Rock/Mixed",
    lineLevel: "Medium",
    bestNights: "Thursday,Saturday"
  },
  {
    id: "bar356",
    name: "356 Bar",
    latitude: 34.68321778370416,
    longitude: -82.83740070964124,
    tagline: "Classic downtown bar energy.",
    vibeTags: "College,Social,Nightlife",
    musicStyle: "Mixed",
    lineLevel: "Medium",
    bestNights: "Thursday,Friday,Saturday"
  },
  {
    id: "nickstavern",
    name: "Nick's Tavern",
    latitude: 34.68363585964464,
    longitude: -82.83791220836441,
    tagline: "Neighborhood-style tavern downtown.",
    vibeTags: "Chill,Social,College",
    musicStyle: "Mixed",
    lineLevel: "Medium",
    bestNights: "Wednesday,Thursday,Friday"
  },
  {
    id: "tripletts",
    name: "Triple T's",
    latitude: 34.68334154440909,
    longitude: -82.83732431237765,
    tagline: "Downtown party anchor.",
    vibeTags: "Dance,College,Social",
    musicStyle: "Top 40",
    lineLevel: "High",
    bestNights: "Thursday,Friday,Saturday"
  },
  {
    id: "roar",
    name: "Roar",
    latitude: 34.68377598519009,
    longitude: -82.83715758322684,
    tagline: "Modern venue for bigger groups.",
    vibeTags: "Groups,Dance,Social",
    musicStyle: "Mixed",
    lineLevel: "High",
    bestNights: "Friday,Saturday"
  },
  {
    id: "charlestonsportspub",
    name: "Charleston Sports Pub",
    latitude: 34.682784409471665,
    longitude: -82.83757047577707,
    tagline: "Sports-first downtown stop.",
    vibeTags: "Sports,Game Day,Social",
    musicStyle: "Mixed",
    lineLevel: "Medium",
    bestNights: "Game Days,Thursday,Friday"
  }
];

async function main() {
  await prisma.bar.deleteMany({
    where: {
      id: { notIn: bars.map((bar) => bar.id) }
    }
  });

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
