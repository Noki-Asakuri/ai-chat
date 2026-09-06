import { ResponsiveCalendar, type CalendarTooltipProps } from "@nivo/calendar";

import { format } from "@/lib/utils";

const colors = ["#0e4429", "#006d32", "#26a641", "#39d353"];
const averageFormat = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });

export function ActivityCalendar({
  activity,
  year,
}: {
  activity: Array<{ day: string; value: number }>;
  year: number | "all";
}) {
  const years =
    year === "all"
      ? Array.from(new Set(activity.map((point) => Number(point.day.slice(0, 4))))).toSorted((a, b) => b - a)
      : [year];
  let total = 0;
  let peak = 0;
  let activeDays = 0;
  for (const point of activity) {
    total += point.value;
    peak = Math.max(peak, point.value);
    if (point.value > 0) activeDays++;
  }
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {years.length === 0 && (
        <p className="py-6 text-sm text-muted-foreground">No daily activity recorded yet.</p>
      )}
      {years.map((calendarYear) => (
        <div key={calendarYear} className="min-w-0">
          {year === "all" && <h3 className="text-sm font-medium">{calendarYear}</h3>}
          <section
            // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard users need to focus the horizontally scrollable calendar.
            tabIndex={0}
            aria-label={`Daily messages in ${calendarYear}; scroll horizontally on smaller screens`}
            className="overflow-x-auto rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
          >
            <div className="h-44 min-w-[640px]">
              <ResponsiveCalendar
                data={activity.filter((point) => Number(point.day.slice(0, 4)) === calendarYear)}
                from={`${calendarYear}-01-01`}
                to={`${calendarYear}-12-31`}
                colors={colors}
                minValue={0}
                maxValue={Math.max(1, peak)}
                emptyColor="var(--muted)"
                monthBorderWidth={0}
                daySpacing={2}
                dayBorderWidth={0}
                yearLegend={() => ""}
                margin={{ top: 24, right: 4, bottom: 4, left: 4 }}
                theme={{ text: { fill: "var(--foreground)" } }}
                tooltip={ActivityTooltip}
              />
            </div>
          </section>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">{format.number(activeDays)}</span> active days ·{" "}
          {averageFormat.format(activeDays === 0 ? 0 : total / activeDays)} messages / active day · Peak{" "}
          {format.number(peak)} / day
        </p>
        <div
          className="flex items-center gap-1.5"
          aria-label="Darker to brighter green indicates fewer to more messages"
        >
          <span>Less</span>
          {["var(--muted)", ...colors].map((color) => (
            <span
              key={color}
              aria-hidden="true"
              className="size-3 rounded-xs"
              style={{ backgroundColor: color }}
            />
          ))}
          <span>More</span>
        </div>
      </div>
      <details className="text-xs text-muted-foreground">
        <summary className="w-fit cursor-pointer rounded-sm py-1 focus-visible:outline-2 focus-visible:outline-ring">
          Daily activity data
        </summary>
        <p className="py-2">
          Daily records include earlier activity that may no longer be recoverable in the summary totals.
          Dates use UTC; unlisted days have no recorded messages.
        </p>
        <div className="max-h-48 overflow-auto">
          <table className="w-full text-left tabular-nums">
            <caption className="sr-only">Recorded daily user messages</caption>
            <thead>
              <tr>
                <th scope="col" className="py-1">
                  Date
                </th>
                <th scope="col" className="py-1 text-right">
                  Messages
                </th>
              </tr>
            </thead>
            <tbody>
              {activity.map((point) => (
                <tr key={point.day} className="border-t">
                  <th scope="row" className="py-1 font-normal">
                    {point.day}
                  </th>
                  <td className="py-1 text-right">{format.number(point.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function ActivityTooltip({ day, value }: CalendarTooltipProps) {
  return (
    <div className="rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground">
      {day}: {format.number(Number(value) || 0)} messages
    </div>
  );
}
