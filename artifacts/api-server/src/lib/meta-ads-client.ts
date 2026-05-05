const META_GRAPH_API = "https://graph.facebook.com/v20.0";

export interface AdInsight {
  campaignId: string;
  campaignName: string;
  adSetId: string;
  adSetName: string;
  status: string;
  dailyBudgetCents: number;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionValue: number;
  cpa: number;
  ctr: number;
  roas: number;
}

export function isMetaAdsConfigured(): boolean {
  return !!(process.env.META_ADS_ACCESS_TOKEN && process.env.META_ADS_ACCOUNT_ID);
}

function token(): string {
  const t = process.env.META_ADS_ACCESS_TOKEN;
  if (!t) throw new Error("META_ADS_ACCESS_TOKEN não configurado");
  return t;
}

function accountId(): string {
  const id = process.env.META_ADS_ACCOUNT_ID;
  if (!id) throw new Error("META_ADS_ACCOUNT_ID não configurado (formato: act_XXXXXXXXX)");
  return id;
}

export async function getAdInsights(datePreset = "today"): Promise<AdInsight[]> {
  const fields = [
    "campaign_id",
    "campaign_name",
    "adset_id",
    "adset_name",
    "spend",
    "impressions",
    "clicks",
    "actions",
    "action_values",
  ].join(",");

  const url =
    `${META_GRAPH_API}/${accountId()}/insights` +
    `?level=adset&date_preset=${datePreset}&fields=${fields}&access_token=${token()}`;

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Meta Insights API ${res.status}: ${body}`);
  }

  const data = (await res.json()) as { data: any[] };

  return (data.data ?? []).map((row) => {
    const purchaseActions = row.actions?.find((a: any) => a.action_type === "purchase");
    const purchaseValues = row.action_values?.find((a: any) => a.action_type === "purchase");
    const conversions = parseFloat(purchaseActions?.value ?? "0");
    const conversionValue = parseFloat(purchaseValues?.value ?? "0");
    const spend = parseFloat(row.spend ?? "0");
    const clicks = parseInt(row.clicks ?? "0", 10);
    const impressions = parseInt(row.impressions ?? "0", 10);

    return {
      campaignId: row.campaign_id ?? "",
      campaignName: row.campaign_name ?? "",
      adSetId: row.adset_id ?? "",
      adSetName: row.adset_name ?? "",
      status: row.effective_status ?? "UNKNOWN",
      dailyBudgetCents: 0,
      spend,
      impressions,
      clicks,
      conversions,
      conversionValue,
      cpa: conversions > 0 ? spend / conversions : 0,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      roas: spend > 0 ? conversionValue / spend : 0,
    };
  });
}

export async function getAdSetStatus(adSetId: string): Promise<{ status: string; dailyBudgetCents: number }> {
  const url =
    `${META_GRAPH_API}/${adSetId}?fields=effective_status,daily_budget&access_token=${token()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Meta AdSet GET ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { effective_status: string; daily_budget: string };
  return {
    status: data.effective_status,
    dailyBudgetCents: parseInt(data.daily_budget ?? "0", 10),
  };
}

export async function pauseAdSet(adSetId: string): Promise<void> {
  const url = `${META_GRAPH_API}/${adSetId}?status=PAUSED&access_token=${token()}`;
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) throw new Error(`Meta pause ${adSetId}: ${await res.text()}`);
}

export async function enableAdSet(adSetId: string): Promise<void> {
  const url = `${META_GRAPH_API}/${adSetId}?status=ACTIVE&access_token=${token()}`;
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) throw new Error(`Meta enable ${adSetId}: ${await res.text()}`);
}

// dailyBudgetBrl is the full amount in BRL (e.g. 50 = R$50/day)
export async function updateAdSetDailyBudget(adSetId: string, dailyBudgetBrl: number): Promise<void> {
  const cents = Math.round(dailyBudgetBrl * 100);
  const url = `${META_GRAPH_API}/${adSetId}?daily_budget=${cents}&access_token=${token()}`;
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) throw new Error(`Meta budget update ${adSetId}: ${await res.text()}`);
}
