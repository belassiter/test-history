Goal: Create an app for users to visualize Bamboo test data and publish it to Confluence

Overview
* I've made a similar app "Jira Burnup" that we can use as a starting point. The code is in the root folder. The UI portion will be similar, and the publishing Confluence is reusable.
* I've made an app for pulling data via the Bamboo API. This is in the reference-app folder. This is a different tech stack (python/etc), but we can use it for a reference on how to interact with the Bamboo API. I will note that the Bamboo API is difficult to use, so this code will be helpful in us avoiding the pain encountered in the previous project "Bamboozle".
* Users should be able to use this both as a webpage with a local server, or as a self-contained electron app.
* Any code not needed for this new app can be discarded

General workflow
1. User provides credentials, system saves them (similar to the example app, but Bamboo details from Bamboozle)
1. The user inputs a list of Bamboo Plan keys, separated by commas.
1. The user clicks "pull data" and the system pulls the data via the Bamboo API
1. Chart: re-use the chart component from Jira Burnup
1. Publish to Confluence: retain existing functionality from Jira Burnup
1. Retain Save/Load Config functionality, and reset button
1. Retain "Date Range", download PNG, Plot Title
1. Remove "Statuses", "Forecast" functionality
1. Retain "Metric", but make it select between % pass/fail or # of pass/fail

Bamboo data
1. What we want to pull is the number of pass and failed tests for each plan for each weekday in the date range. If there are multiple builds on a day, it should take the FIRST build of the day (chronologically).
1. Only consider builds that have tests. (There is an indicator in Bamboo API/Bamboozle logic to determine that).
1. If there is no data for a plan on a given day (e.g. no build ran), register as zero (0).
1. In Bamboozle, there is a UI section called "Builds". This should have functionality that queries the API to find builds on a plan, and then retrieves information like number of pass and fail. I know it's a python backend, but we can at least understand the API calls from there and how the data is formatted.
1. We don't need to pull data on the details of the tests, just the aggregate numbers for pass/fail. The chart legend will just show "Pass" and "Fail".
1. Here, for each date on the x-axis, add the total number of passes and fails across all given plans for that date.
1. Chart Metrics dropdown: This should allow the user to select between "% Pass/Fail" (normalized stacked bar/area chart, 100% total height, showing `total pass / total tests`) or "# Count" (stacked area/bar chart showing absolute count of tests). The default is "% Pass/Fail" (normalized bar chart).
1. In the stacked chart, the green area should be passing tests and orange area failing tests.
1. Hover text should show both % and absolute numbers.

Credentials & Settings
1. Repurpose the existing `CredentialsModal` to save Bamboo configuration details instead of Jira details.
1. Inputs for Bamboo credentials should just be: Host (e.g. `https://bamboo.tandemdiabetes.com`) and Personal Access Token. (No email needed).







