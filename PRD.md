# Product Requirements Document (PRD): Automated Video Content Moderation & Trigger Filtering Extension

---

## 1. Executive Summary & Value Proposition

* **Product Concept:** A lightweight browser extension coupled with an intelligent backend that automatically detects streaming video elements, evaluates content against user-defined safety presets, and seamlessly skips or mutes harmful scenes.
* **Core Value:** Gives viewers absolute control over their viewing experience by filtering out unwanted content—ranging from age-restricted material (12+, 15+) to specific phobias and triggers (spiders, gore)—without breaking immersion.
* **Competitive Edge:** Leverages OpenAI’s high-speed **Decisions API (powered by GPT-6 Luna)** for cost-effective, precise binary classification, combining a zero-cost global pre-processed database with a real-time fallback inference pipeline for unindexed content.

---

## 2. User Presets & Taxonomy

Users can toggle multiple modular filter profiles simultaneously:

* **Age Ratings:** Under-12, Under-15, Mature/R-rated exclusions.
* **Phobia Triggers:** Arachnophobia (spiders/insects), blood and gore.
* **Sensory Cues:** Flashing lights / seizure risk profiles (future iteration).

---

## 3. System Architecture & Technical Flow

The product operates on a dual-layer architecture designed to optimize performance and minimize API operational costs:

### Layer 1: The Global Pre-Processed Database (Zero Marginal Cost)

* **Mechanism:** Mainstream movies and popular media files are batch-processed ahead of time using the Decisions API at a 1–2 fps sample rate.
* **Storage:** Frame classifications are aggregated into continuous timestamp ranges (`start` to `end` seconds) and stored in a centralized database.
* **Execution:** When a user plays a known video anywhere on the web, the extension queries the database instantly, executing smooth, native skips (`video.currentTime = range.end`) with zero live AI compute cost.

### Layer 2: Live Buffer Fallback Pipeline (On-Demand AI)

* **Mechanism:** If a video is unindexed (e.g., obscure indie streams, user uploads, or arbitrary web video URLs), the extension intercepts the video player's upcoming buffered chunks (e.g., 10-second look-ahead).
* **Frame Extraction:**
* *Standard Web Players:* Direct HTML5 `<canvas>` capture.
* *DRM Platforms (Netflix, Disney+):* Secure viewport sampling via browser extensions (`chrome.tabCapture`).


* **Live Inference:** Frames are batched and passed to the Decisions API (GPT-6 Luna), which returns instant, typed binary decision maps.
* **Caching:** Once a live stream chunk is analyzed, its timestamps are permanently saved to the global database so future viewers benefit instantly.

---

## 4. Monetization Strategy

* **Freemium / Free Tier:** Unlimited access to the crowdsourced database of pre-scanned mainstream movies and media (zero AI overhead for the platform).
* **Credit-Based Pro Tier:** A prepaid credit system for power users streaming unindexed content live, ensuring healthy margins on real-time GPT-6 Luna API calls.

---

## 5. Development Roadmap

* **Phase 1 (MVP):** Scaffold the Manifest V3 browser extension using code-generation tools to handle DOM video detection, basic timestamp skipping, and database fetching.
* **Phase 2 (Backend & Pipeline):** Build the ingestion pipeline using OpenAI's Decisions API endpoint to ingest test films and map out timestamp intervals.
* **Phase 3 (Live Fallback & Credit System):** Implement real-time buffer interception, local IndexedDB caching, and the user credit billing portal.