const { seedTaskTemplates } = require("../services/task-template-seed");

async function main() {
  const result = await seedTaskTemplates();
  console.log(
    `Task templates seeded (upserted=${result.upserted}, total=${result.total})`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
