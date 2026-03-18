export interface BuildData {
    planKey: string;
    buildNumber: number;
    buildState: string;
    buildCompletedTime: string; // ISO date string
    successfulTestCount: number;
    failedTestCount: number;
    quarantinedTestCount: number;
    skippedTestCount: number;
    totalTestCount: number;
}

export interface ConfluenceConfig {
    confluenceUrl: string;
    personalAccessToken: string;
    pageUrl: string;
    attachmentFilename: string;
}
