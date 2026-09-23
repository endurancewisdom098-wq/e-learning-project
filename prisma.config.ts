import "dotenv/config";
export default {
	schema: "prisma/schema.prisma",
	migrations: {
		path: "prisma/migrations",
	},
	datasource: {
		url: process.env.DATABASE_URL,
	},
};

//  export default defineConfig({
//     migrations: {
//       seed: 'bun·./prisma/seed.ts',
//  },

//   datasource: {
//       url: '[your database URL]',
//     },
// })

