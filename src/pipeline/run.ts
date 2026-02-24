import { collectNews, saveCollectedNews } from "./collect";
import { generateNewsletter, saveNewsletter } from "./generate";
import { publishToBlog, publishToSnsViaGetlate, sendViaBrevo } from "./publish";

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

  // Step 3: Brevo 이메일 캠페인 발송
  console.log("--- Step 3: Brevo Email Campaign ---");
  const emailSent = await sendViaBrevo(newsletterId);
  if (emailSent) {
    console.log("Newsletter sent via Brevo email campaign.");
  } else {
    console.log("Brevo email campaign skipped (not configured or mock mode).");
  }

  // Step 4: Publish to Blog
  console.log("--- Step 4: Publish to Blog ---");
  const blogged = await publishToBlog(newsletterId);
  if (blogged) {
    console.log("Newsletter published to blog.");
  } else {
    console.log("Blog publish skipped or failed.");
  }

  // Step 5: SNS 배포 (getlate.dev)
  console.log("--- Step 5: SNS Publish (getlate.dev) ---");
  const snsPublished = await publishToSnsViaGetlate(newsletterId);
  if (snsPublished) {
    console.log("Newsletter published to SNS via getlate.dev.");
  } else {
    console.log("SNS publish skipped (getlate not configured or no accounts connected).");
  }

  console.log(`\n=== Pipeline Complete ===`);
  console.log(`Finished at: ${new Date().toISOString()}`);
}

runPipeline().catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
