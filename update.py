import sys

content = '''import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { BuildData } from "../types";

dayjs.extend(utc);
dayjs.extend(timezone);

export function processBambooData(
    builds: BuildData[],
    startDate: Date,
    endDate: Date
) {
    const dataByDate: any[] = [];

    // Get unique plan keys
    const planKeys = Array.from(new Set(builds.map(b => b.planKey)));
    let currentDate = dayjs(startDate).tz("America/Los_Angeles").startOf("day");
    const end = dayjs(endDate).tz("America/Los_Angeles").endOf("day");

    while (currentDate.isBefore(end) || currentDate.isSame(end, "day")) {
        // Skip weekends
        const dayOfWeek = currentDate.day();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            currentDate = currentDate.add(1, "day");
            continue;
        }

        const dateStr = currentDate.format("YYYY-MM-DD");

        let totalPass = 0;
        let totalFail = 0;
        const planMetrics: any = {};

        for (const planKey of planKeys) {
            // Find builds for this plan on this day that have tests
            const planBuildsOnDay = builds.filter(b => {
                const bDate = dayjs(b.buildCompletedTime).tz("America/Los_Angeles").format("YYYY-MM-DD");
                const hasTests = (b.successfulTestCount > 0) || (b.failedTestCount > 0);
                return b.planKey === planKey && bDate === dateStr && hasTests;
            });

            let planFail = 0;
            if (planBuildsOnDay.length > 0) {
                // Sort by time ascending
                planBuildsOnDay.sort((a, b) => new Date(a.buildCompletedTime).getTime() - new Date(b.buildCompletedTime).getTime());
                // take the first build of the day
                const firstBuild = planBuildsOnDay[0];
                totalPass += firstBuild.successfulTestCount;
                planFail = firstBuild.failedTestCount;
                totalFail += planFail;
            }
            planMetrics["Fail_" + planKey] = planFail;
        }

        const total = totalPass + totalFail;

        dataByDate.push({
            date: dateStr,
            Pass: totalPass,
            Fail: totalFail,
            Total: total,
            PassPercent: total > 0 ? (totalPass / total) : 0,
            FailPercent: total > 0 ? (totalFail / total) : 0,
            ...planMetrics
        });

        currentDate = currentDate.add(1, "day");
    }

    return dataByDate;
}
'''
with open('src/utils/dataProcessor.ts', 'w') as f:
    f.write(content)
