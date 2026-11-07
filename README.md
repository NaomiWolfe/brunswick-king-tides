# Brunswick King Tides: Know Before the Water Rises

A community education and planning tool for coastal Glynn County, Georgia (Brunswick and St. Simons Island). It shows when king tides are predicted, explains why tide tables alone do not predict flooding, and points people to official alerts.

**This is not an emergency tool.** It never says a road, area, or time is safe or clear. It gives no driving directions, road status, or push notifications. Always follow the [National Weather Service in Jacksonville](https://www.weather.gov/jax/) and [Glynn County Emergency Management](https://www.glynncounty.org/government/departments/emergency-management-agency-ema).

## What it shows

1. **NWS alerts** for Coastal Glynn (zone GAZ154), loaded live. If the alert feed fails, the page says so and does not show "no alerts."
2. **Next king tide window**, chosen automatically from saved NOAA predictions.
3. **High tide calendar** for Howe Street Pier, Brunswick (8677406) and St. Simons Island (8677344), November 2026 through December 2027.
4. **Why the tide table isn't enough**: predicted versus observed high water at St. Simons Village Pier, Oct 7 to Nov 6, 2026, with a text table.
5. **Measured water now** from gauge BRNG1 (USGS 02226180), loaded live, with the reading time and a stale warning.
6. **Planning tips and official links.**
7. **About the data**: datums and the local king tide guideline.

## Data sources

| Data | Source |
| --- | --- |
| Active alerts | `https://api.weather.gov/alerts/active/zone/GAZ154` (live) |
| Measured water level | `https://api.water.noaa.gov/nwps/v1/gauges/BRNG1` (live) |
| Flood stages (ft above MHHW) | NWS: Action 1.5, Minor 2.0, Moderate 2.5, Major 3.5 |
| Tide predictions | NOAA CO-OPS stations 8677406 and 8677344, saved Nov 6, 2026 |

Saved data lives in `/data` as CSV files. `data.js` is generated from those CSVs so the page also works when opened directly from a computer.

"King tide" here means a high tide predicted at 1.0 ft or more above MHHW. This is a practical local guideline, not an official definition.

## Files

- `index.html`: page structure and styles
- `app.js`: rendering and live data loading
- `data.js`: saved predictions and October comparison data
- `data/`: source CSV files

## Run it

Open `index.html` in a browser, or publish with GitHub Pages (Settings, Pages, deploy from the `main` branch, root folder).

## Updating the data

The saved predictions run through December 31, 2027. Before then, download new high/low predictions from [NOAA Tides and Currents](https://tidesandcurrents.noaa.gov/) for both stations, update the CSVs in `/data`, and regenerate `data.js`.

## Accessibility

Skip link, visible focus outlines, reduced-motion support, screen reader labels for every calendar day, a text alternative and data table for the chart, and live-region announcements for alerts and gauge readings.

## Credits

Built by Naomi Latini Wolfe, a Brunswick educator working on community and AI literacy. Built with help from Google AI Studio and Perplexity Computer; data and safety wording reviewed by a person. Questions or corrections: please [open an issue](https://github.com/NaomiWolfe/brunswick-king-tides/issues).
