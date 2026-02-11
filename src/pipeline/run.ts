import { collectNews, saveCollectedNews } from "./collect";
import { generateNewsletter, saveNewsletter } from "./generate";
import { sendViaStibee, publishToBlog } from "./publish";

async function runPipeline() {
  console.log("=== AI Newsletter Pipeline ===");
  console.log(`Started at: ${new Date().toISOString()}\n`);

  // Step 1: Collect news
  console.log("--- Step 1: Collect News ---");
  const items = await collectNews();
  const saved = await saveCollectedNews(items);
  console.log(`Collected ${items.length} items, saved ${saved} new.\n`);

  // Step 2: Generate newsletter
  console.log("--- Step 2: Generate Newsletter ---");
  const newsletter = await generateNewsletter();
  if (!newsletter) {
    console.log("No newsletter generated. Exiting.");
    return;
  }
  const newsletterId = await saveNewsletter(newsletter);
  if (!newsletterId) {
    console.log("Failed to save newsletter. Exiting.");
    return;
  }
  console.log(`Newsletter saved: ${newsletterId}\n`);

  // Step 3: Publish
  console.log("--- Step 3: Publish ---");
  const sent = await sendViaStibee(newsletterId);
  if (sent) {
    console.log("Newsletter sent via Stibee.");
  } else {
    console.log("Stibee send skipped (API key not set or error).");
  }

  const blogged = await publishToBlog(newsletterId);
  if (blogged) {
    console.log("Newsletter published to blog.");
  } else {
    console.log("Blog publish skipped or failed.");
  }

  console.log(`\n=== Pipeline Complete ===`);
  console.log(`Finished at: ${new Date().toISOString()}`);
}

runPipeline().catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
