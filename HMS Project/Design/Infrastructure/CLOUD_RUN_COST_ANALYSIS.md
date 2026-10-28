# HMS Backend — Google Cloud Run Cost Analysis

**Date:** 2026-09-29  
**Target:** `@hms/api` Production & POC Hosting Cost Models  
**Scope:** Pricing Breakdown for Cloud Run, MongoDB Atlas, and Infrastructure Comparisons  

---

## 1. Executive Summary

This document details the cost structure for running the HMS API backend on Google Cloud Run compared to Render Free and Paid tiers. Calculations are based on official Google Cloud Pricing (Tier 1 regions: `us-central1`, `europe-west1`, `asia-south1`).

---

## 2. Google Cloud Run Free Tier Allowances (Monthly)

Google Cloud provides a perpetual free tier that resets every month:
- **Requests:** 2,000,000 free requests per month.
- **Compute Time (vCPU):** 180,000 vCPU-seconds free per month (~50 hours of active 1-vCPU processing).
- **Memory:** 360,000 GiB-seconds free per month.
- **Egress (Bandwidth):** 1 GiB free egress to North America / Europe per month.

---

## 3. Cost Model Scenarios

### Scenario A: Cloud Run POC / Dev Testing (`min_instances = 0`)
- **Configuration:** 1 vCPU, 512 MiB RAM, concurrency = 80, scale to zero when idle.
- **Monthly Request Volume:** ~50,000 – 200,000 requests.
- **Monthly Compute Seconds:** Well within the 180,000 free vCPU-second limit.
- **Estimated Cloud Run Compute Cost:** **$0.00 / month** (100% covered by Free Tier).
- **Estimated Artifact Registry Storage Cost (1 Container Image ~150MB):** **~$0.04 / month**.
- **Total POC Cost:** **~$0.04 / month**.

---

### Scenario B: Production Cloud Run with Scale-to-Zero (`min_instances = 0`)
- **Configuration:** 1 vCPU, 1 GiB RAM, request timeout = 60s, auto-scaling 0 to 5 instances.
- **Monthly Request Volume:** 500,000 requests.
- **Average Execution Duration:** 250ms per request.
- **Total Billable Execution Time:** 500,000 × 0.25s = 125,000 vCPU-seconds.
- **Free Tier Deduction:** -180,000 vCPU-seconds.
- **Net Billable Compute:** 0 vCPU-seconds.
- **Estimated Total Cost:** **~$0.10 – $1.50 / month** (primarily network egress and registry storage).

---

### Scenario C: Production Cloud Run with Warm Standby (`min_instances = 1`)
- **Configuration:** 1 vCPU, 512 MiB RAM, 1 instance always kept in memory to eliminate cold starts.
- **Active Hours:** 730 hours / month (2,628,000 seconds).
- **Idle CPU Allocation Pricing:** $0.0000025 per vCPU-second (discounted rate when no requests are active).
- **Monthly Idle vCPU Cost:** 2,628,000 × $0.0000025 = **$6.57 / month**.
- **Monthly Idle Memory Cost (512MB):** 2,628,000 × 0.5 GiB × $0.00000025 = **$0.33 / month**.
- **Active Request Surcharge (500k requests):** Free tier offsets active CPU.
- **Total Estimated Cost (`min_instances = 1`):** **~$6.90 – $8.00 / month**.

---

## 4. Comprehensive Infrastructure Cost Comparison

| Hosting Option | Monthly Compute Cost | Container Persistence | Cold Start Delay | Database Cost (Atlas) | Total Monthly Estimate |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **1. Render Free Tier (Current)** | **$0.00** | Ephemeral | 30s – 50s | $0.00 (M0 Free) | **$0.00 / month** |
| **2. Render Starter Plan (Paid)** | **$7.00** | Always On | 0ms | $0.00 (M0 Free) | **$7.00 / month** |
| **3. Cloud Run (`min_instances = 0`)** | **$0.00 – $1.50** | Scale to Zero | 1.8s – 2.5s | $0.00 (M0 Free) | **~$0.50 / month** |
| **4. Cloud Run (`min_instances = 1`)** | **$6.90 – $8.00** | Always On | 0ms | $0.00 (M0 Free) | **~$7.50 / month** |

---

## 5. Cost Policy & Authorization Rules

- **Zero Unapproved Spend:** No paid Google Cloud resources or billing accounts have been linked or provisioned in this audit.
- **Free Tier Safety:** The Cloud Run POC model remains fully within Google Cloud's free monthly tier.
