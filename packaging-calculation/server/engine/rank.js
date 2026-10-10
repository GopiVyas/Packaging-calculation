export function rankResults(results, goal = 'space') {
  const key = goal === 'cost' ? 'estimatedCost' : goal === 'containers' ? 'containersNeeded' : 'spaceUsedPercent'
  return [...results].sort((a, b) => (a[key] ?? Infinity) - (b[key] ?? Infinity)).map((result, index) => ({ ...result, rank: index + 1, explanation: goal === 'cost' ? 'Lowest estimated packaging cost.' : goal === 'containers' ? 'Uses the fewest containers.' : 'Uses the least carton space.' }))
}