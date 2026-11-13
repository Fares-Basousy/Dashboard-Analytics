/** Non-secret business settings (server env, with sensible Swiss defaults). */
const num = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && process.env[name] ? v : fallback;
};

export const costConfig = () => ({
  /** What the shop pays the carrier per order (Swiss Post parcel). */
  shippingCostPerOrder: num("SHIPPING_COST_PER_ORDER", 6.5),
  paymentFeePct: num("PAYMENT_FEE_PCT", 0.029),
  paymentFeeFixed: num("PAYMENT_FEE_FIXED", 0.3),
});

export type CostConfig = ReturnType<typeof costConfig>;
