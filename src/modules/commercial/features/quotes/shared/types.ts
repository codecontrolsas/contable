// Types are inferred from action return types
// Import from actions.server.ts using:
//   type Quote = Awaited<ReturnType<typeof getQuotesPaginated>>['data'][number]
//   type QuoteDetail = Awaited<ReturnType<typeof getQuoteById>>
