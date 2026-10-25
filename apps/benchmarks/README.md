# Benchmarks

A workbench that renders the same table with **data-grid-kit**, **MUI X** (`DataGridPro`) and **AG Grid** (Community) and measures them in Chrome. It is private and not published. The results are summarised in the [repository README](../../README.md#performance).

What it measures, for 10,000 and 100,000 rows of 8 columns (text, number, date, boolean):

- time until the first rows are on screen (the library's code is loaded before the clock starts)
- sorting by a text and by a number column, the quick filter and clearing it (from the call to the frame that paints the result)
- 150 frames of scrolling, 20 rows per frame: mean, 95th percentile and slowest frame, and how many are slower than 30 fps
- JS heap after a garbage collection, DOM nodes, and the gzipped size each library adds to the page

## Run it

```bash
npm run build -w data-grid-kit
npm run build -w benchmarks
npm run preview -w benchmarks      # serves the production build on :5600
npm run bench -w benchmarks        # in another terminal; writes results.json
node apps/benchmarks/report.mjs    # prints the tables used in the README
```

`RUNS` (default 5), `SIZES` (default `10000,100000`), `THROTTLE` (CPU slowdown during the interactions, default 4), `CHROME` (path to Chrome) and `BENCH_URL` can be set in the environment.

## Notes

- One adapter per library in `src/`, each with the same columns, row height and controls (`src/types.ts`). Sorting and filtering go through each grid's own API so that the UI of the toolbars does not decide the result.
- The rows come from a seeded generator, so every library gets the same data on every run.
- MUI X Pro runs without a license key (it only draws a watermark). Keep that in mind before quoting the numbers: they are for this workload, on one machine.
