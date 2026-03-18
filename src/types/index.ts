export interface BuildData {
    planKey: string;
    buildCompletedTime: string; // ISO date string
    successfulTestCount: number;
    failedTestCount: number;
}

export interface ConfluenceConfig {
    confluenceUrl: string;
    personalAccessToken: string;
    pageUrl: string;
    attachmentFilename: string;
}
