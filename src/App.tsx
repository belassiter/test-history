import { useState, useEffect, useMemo, useRef } from 'react';
import { AppShell, Group, Text, TextInput, Button, Paper, Stack, Select, SegmentedControl, ActionIcon, Notification } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useDisclosure } from '@mantine/hooks';
import { CredentialsModal } from './components/CredentialsModal';
import { ConfluenceSettingsModal } from './components/ConfluenceSettingsModal';
import { BulkPublishModal } from './components/BulkPublishModal';
import { Area, Bar, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Label } from 'recharts';
import { processBambooData } from './utils/dataProcessor';
import { getRoundedYAxisMax, getYAxisTicks } from './utils/chartAxis';
import { getXAxisTicks } from './utils/xAxis';
import { BuildData, ConfluenceConfig } from './types';
import { IconDeviceFloppy, IconFolderOpen, IconSettings, IconDownload, IconRefresh, IconCheck, IconX, IconStack2 } from '@tabler/icons-react';
import { toPng } from 'html-to-image';
import { getConfluenceAttachmentFilename, getLoadedConfluenceChartConfig, parseConfluencePageId } from './utils/confluence';

import '@mantine/dates/styles.css';

const METRICS = [
  { value: 'percent', label: '% Pass/Fail' },
  { value: 'count', label: '# Count' },
  { value: 'fail_percent', label: 'Fail %' },
  { value: 'fail_count', label: 'Fail #' }
];

export interface BulkPublishJob {
    path: string;
    filename: string;
    status: 'pending' | 'active' | 'success' | 'failed';
}

const PLAN_COLORS = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"];

export default function App() {
  const [credentialsOpen, { open: openCredentials, close: closeCredentials }] = useDisclosure(false);
  const [confluenceModalOpen, { open: openConfluenceModal, close: closeConfluenceModal }] = useDisclosure(false);
  const [bulkPublishModalOpen, { open: openBulkPublishModal, close: closeBulkPublishModal }] = useDisclosure(false);

  // Data State
  const [plans, setPlans] = useState('PSAT-CIQRRG7');
  const [buildData, setBuildData] = useState<BuildData[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Chart Configuration
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([new Date(new Date().setDate(new Date().getDate() - 14)), new Date()]);
  const [metric, setMetric] = useState<string | null>('fail_percent');
  const [graphTitle, setGraphTitle] = useState('Test History');
  const [graphType, setGraphType] = useState('bar');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  // Confluence State
  const [confluenceConfig, setConfluenceConfig] = useState<ConfluenceConfig>({
      confluenceUrl: '',
      personalAccessToken: '',
      pageUrl: '',
      attachmentFilename: 'test-history-latest.png'
  });
  const [publishingConfluence, setPublishingConfluence] = useState(false);
  
  
  
  
  const [snackbar, setSnackbar] = useState<{ message: string; color: 'green' | 'red' } | null>(null);

  const chartData = useMemo(() => {
    if (!dateRange[0] || !dateRange[1]) return [];
    return processBambooData(buildData, dateRange[0], dateRange[1]);
  }, [buildData, dateRange]);

  const yAxisConfig = useMemo(() => {
        if (metric === 'percent') {
            return { domainMax: 1, ticks: [0, 0.25, 0.5, 0.75, 1] };
        }

        let maxStack = 0;
        chartData.forEach(d => {
            let sum = d.Total;
            if (metric === 'fail_percent') sum = d.FailPercent || 0;
            if (metric === 'fail_count') sum = d.Fail || 0;
            if (sum > maxStack) maxStack = sum;
        });

        if (maxStack === 0) maxStack = metric === 'fail_percent' ? 0.1 : 10;

        const domainMax = getRoundedYAxisMax(maxStack);
        const ticks = getYAxisTicks(maxStack);
        return { domainMax, ticks };
    }, [chartData, metric]);
  const xAxisTicks = useMemo(() => {
      const availableDates = chartData.map(d => d.date);
      return getXAxisTicks(availableDates, dateRange[0], dateRange[1]);
  }, [chartData, dateRange]);

  useEffect(() => {
    const checkCreds = async () => {
        try {
            const exists = await window.ipcRenderer.invoke('has-credentials');
            if (!exists) {
                openCredentials();
            }
        } catch (e) {
            console.error("Failed to check credentials", e);
        }
    };
    checkCreds();
  }, []);

  useEffect(() => {
      const loadConfluenceConfig = async () => {
          try {
              const savedConfig = await window.ipcRenderer.invoke('get-confluence-config');
              if (savedConfig && typeof savedConfig === 'object') {
                  setConfluenceConfig({
                      confluenceUrl: savedConfig.confluenceUrl || '',
                      personalAccessToken: savedConfig.personalAccessToken || '',
                      pageUrl: savedConfig.pageUrl || '',
                      attachmentFilename: getConfluenceAttachmentFilename(savedConfig.attachmentFilename)
                  });
              }
          } catch (e) {
              console.error('Failed to load Confluence settings', e);
          }
      };
      loadConfluenceConfig();
  }, []);

  useEffect(() => {
      if (!snackbar) return;
      const timer = window.setTimeout(() => setSnackbar(null), 4000);
  return () => window.clearTimeout(timer);
  }, [snackbar]);

  const handleFetchData = async (query = plans) => {
      setLoading(true);
      try {
          const result = await window.ipcRenderer.invoke('get-bamboo-data', query);
          setBuildData(result);
      } catch (err: any) {
          console.error(err);
          alert("Failed to fetch data: " + err.message);
      } finally {
          setLoading(false);
      }
  };

  const saveConfiguration = async () => {
      const config = {
          plans,
          dateRange,
          metric,
          graphTitle,
          graphType,
          confluenceConfig: {
              pageUrl: confluenceConfig.pageUrl,
              attachmentFilename: getConfluenceAttachmentFilename(confluenceConfig.attachmentFilename)
          }
      };
      
      try {
          const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'test-history-config.json';
          a.click();
          URL.revokeObjectURL(url);
      } catch (e) {
          console.error("Save failed", e);
      }
  };

  const loadConfiguration = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json';

      input.onchange = (e: any) => {
          const file = e.target.files[0];
          if (!file) return;

          const reader = new FileReader();
          reader.onload = async (event) => {
              try {
                  const config = JSON.parse(event.target?.result as string);
                  if (config.plans) setPlans(config.plans);
                  if (config.dateRange) setDateRange([
                      config.dateRange[0] ? new Date(config.dateRange[0]) : null, 
                      config.dateRange[1] ? new Date(config.dateRange[1]) : null
                  ]);
                  if (config.metric) setMetric(config.metric);
                  if (config.graphTitle) setGraphTitle(config.graphTitle);
                  if (config.graphType) setGraphType(config.graphType);
                  const loadedConfluenceChartConfig = getLoadedConfluenceChartConfig(config.confluenceConfig);
                  setConfluenceConfig(prev => ({
                      ...prev,
                      pageUrl: loadedConfluenceChartConfig.pageUrl,
                      attachmentFilename: loadedConfluenceChartConfig.attachmentFilename
                  }));

                  if (config.plans) {
                      await handleFetchData(config.plans);
                  }
              } catch {
                  alert("Invalid config file");
              }
          };
          reader.onerror = () => {
              alert('Failed to read config file');
          };
          reader.readAsText(file);
      };
      input.click();
  };
  
  const resetConfiguration = () => {
      if (confirm('Are you sure you want to reset the configuration?')) {
        setPlans('PSAT-CIQRRG7');
        setBuildData([]);
        setDateRange([new Date(new Date().setDate(new Date().getDate() - 14)), new Date()]);
        setMetric('percent');
        setGraphTitle('Test History');
        setGraphType('bar');
        setConfluenceConfig(prev => ({
            ...prev,
            pageUrl: '',
            attachmentFilename: 'test-history-latest.png'
        }));
      }
  };

  const handleConfluenceConfigSave = async (config: ConfluenceConfig) => {
      const normalizedConfig = {
          ...config,
          attachmentFilename: getConfluenceAttachmentFilename(config.attachmentFilename)
      };
      setConfluenceConfig(normalizedConfig);
      const result = await window.ipcRenderer.invoke('save-confluence-config', normalizedConfig);
      if (!result?.success) {
          throw new Error(result?.error || 'Failed to save Confluence settings');
      }
  };

  const handleBulkPublishSequence = async (configPaths: string[]) => {
      closeBulkPublishModal();

      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < configPaths.length; i++) {
          try {
              const raw = await window.ipcRenderer.invoke('read-file-content', configPaths[i]);
              const config = JSON.parse(raw);

              if (config.plans) setPlans(config.plans);
              if (config.dateRange) setDateRange([
                  config.dateRange[0] ? new Date(config.dateRange[0]) : null,
                  config.dateRange[1] ? new Date(config.dateRange[1]) : null
              ]);
              if (config.metric) setMetric(config.metric);
              if (config.graphTitle) setGraphTitle(config.graphTitle);
              if (config.graphType) setGraphType(config.graphType);

              const loadedCConfig = getLoadedConfluenceChartConfig(config.confluenceConfig);
              setConfluenceConfig(prev => ({
                  ...prev,
                  pageUrl: loadedCConfig.pageUrl,
                  attachmentFilename: loadedCConfig.attachmentFilename
              }));

              if (config.plans) {
                  await handleFetchData(config.plans);
              }

              if (!chartRef.current) throw new Error("Chart reference lost");

              for (let j = 0; j < 30; j++) {
                  const surface = chartRef.current.querySelector('.recharts-surface');
                  if (surface) {
                      const rect = surface.getBoundingClientRect();
                      if (rect.width > 0 && rect.height > 0) {
                          break;
                      }
                  }
                  await new Promise(r => setTimeout(r, 100));
              }

              await new Promise(r => setTimeout(r, 500));

              const latestConfluenceCreds = await window.ipcRenderer.invoke('get-confluence-config');
              const safeConfluenceURL = latestConfluenceCreds?.confluenceUrl || confluenceConfig.confluenceUrl;
              const safeToken = latestConfluenceCreds?.personalAccessToken || confluenceConfig.personalAccessToken;

              const filter = (node: HTMLElement) => {
                  const exclusionClasses = ['recharts-tooltip-wrapper', 'no-capture'];
                  if (node.classList && exclusionClasses.some((classname) => node.classList.contains(classname))) {
                      return false;
                  }
                  return true;
              };
              
              await new Promise(r => setTimeout(r, 500));

              const dataUrl = await toPng(chartRef.current, { cacheBust: true, backgroundColor: '#ffffff', filter });

              const publishResult = await window.ipcRenderer.invoke('publish-confluence', {
                  config: {
                      confluenceUrl: safeConfluenceURL,
                      personalAccessToken: safeToken,
                      pageUrl: loadedCConfig.pageUrl,
                      attachmentFilename: getConfluenceAttachmentFilename(loadedCConfig.attachmentFilename)
                  },
                  imageDataUrl: dataUrl,
                  graphTitle: config.graphTitle,
                  jql: config.plans
              });

              if (publishResult.success) {
                  successCount++;
                  ;
              } else {
                  console.error("Bulk publish failed for", configPaths[i], publishResult.error);
                  failCount++;
                  ;
              }

          } catch (e: any) {
              console.error("Failed handling bulk config:", configPaths[i], e);
              failCount++;
              ;
          }
      }

      ;
      setSnackbar({
          message: `Bulk Publish complete. ${successCount} succeeded, ${failCount} failed.`,
          color: failCount > 0 ? 'red' : 'green'
      });

      setTimeout(() => {
          ;
      }, 5000);
  };

  const handlePublishToConfluence = async () => {
      if (!chartRef.current) return;

      if (!confluenceConfig.confluenceUrl || !confluenceConfig.personalAccessToken || !confluenceConfig.pageUrl) {
          setSnackbar({ message: 'Please fill Confluence settings before publishing.', color: 'red' });
          openConfluenceModal();
          return;
      }

      const parsedPageId = parseConfluencePageId(confluenceConfig.pageUrl);
      if (!parsedPageId) {
          setSnackbar({ message: 'Confluence page URL is missing a valid page ID.', color: 'red' });
          openConfluenceModal();
          return;
      }

      setPublishingConfluence(true);
      try {
          const filter = (node: HTMLElement) => {
              if (node.classList && node.classList.contains('no-capture')) {
                  return false;
              }
              return true;
          };

          const dataUrl = await toPng(chartRef.current, { cacheBust: true, backgroundColor: '#ffffff', filter });
          const publishResult = await window.ipcRenderer.invoke('publish-confluence', {
              config: {
                  ...confluenceConfig,
                  attachmentFilename: getConfluenceAttachmentFilename(confluenceConfig.attachmentFilename)
              },
              imageDataUrl: dataUrl,
              graphTitle,
              jql: plans
          });

          if (!publishResult.success) {
              setSnackbar({ message: `Confluence publish failed: ${publishResult.error || 'Unknown error'}`, color: 'red' });
              return;
          }

          setSnackbar({ message: 'Published chart to Confluence.', color: 'green' });
      } catch (e: any) {
          console.error('Failed publishing to Confluence', e);
          setSnackbar({ message: `Confluence publish failed: ${e?.message || 'Unknown error'}`, color: 'red' });
      } finally {
          setPublishingConfluence(false);
      }
  };

  const downloadPng = async () => {
      if (!chartRef.current) return;
      try {
          const filter = (node: HTMLElement) => {
              if (node.classList && node.classList.contains('no-capture')) {
                  return false;
              }
              return true;
          };
          const dataUrl = await toPng(chartRef.current, { cacheBust: true, backgroundColor: '#ffffff', filter });
          const link = document.createElement('a');
          const now = new Date();
          const dateString = now.toLocaleDateString('en-CA');
          const timeString = now.toLocaleTimeString('en-GB', { hour12: false }).replace(/:/g, '-');
          link.download = `${graphTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${dateString}_${timeString}.png`;
          link.href = dataUrl;
          link.click();
      } catch (e) {
          console.error('Fail to create PNG', e);
      }
  };

  const metricLabel = METRICS.find(m => m.value === metric)?.label || metric;
  const uniquePlans = plans.split(",").map(p => p.trim()).filter(Boolean);

  return (
    <AppShell
      header={{ height: 60 }}
      padding="md"
      layout="alt"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Text fw={700}>Bamboo Test History</Text>
          <Group>
            <Button leftSection={<IconSettings size={16} />} color="blue" variant="light" onClick={openConfluenceModal}>Settings</Button>
            <Button leftSection={<IconStack2 size={16} />} color="blue" variant="light" onClick={openBulkPublishModal}>Bulk Publish</Button>
            <Button color="blue" loading={publishingConfluence} onClick={handlePublishToConfluence}>Publish</Button>
            
            <ActionIcon variant="light" color="blue" onClick={openCredentials} title="Configure Credentials" size="lg" ml="md">
                <IconSettings size="1.2rem" />
            </ActionIcon>
            <Button leftSection={<IconRefresh size={16} />} variant="default" color="red" onClick={resetConfiguration}>Reset</Button>
            <Button leftSection={<IconDeviceFloppy size={16} />} variant="default" onClick={saveConfiguration}>Save Config</Button>  
            <Button leftSection={<IconFolderOpen size={16} />} variant="default" onClick={loadConfiguration}>Load Config</Button>    
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Main style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <CredentialsModal opened={credentialsOpen} onClose={closeCredentials} canClose={true} />
        <BulkPublishModal opened={bulkPublishModalOpen} onClose={closeBulkPublishModal} onPublish={handleBulkPublishSequence} />
        <ConfluenceSettingsModal
            opened={confluenceModalOpen}
            onClose={closeConfluenceModal}
            config={confluenceConfig}
            onSave={handleConfluenceConfigSave}
        />

        {snackbar && (
            <Notification
                icon={snackbar.color === 'green' ? <IconCheck size={20} /> : <IconX size={20} />}
                color={snackbar.color}
                onClose={() => setSnackbar(null)}
                withCloseButton
                style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 1000 }}
                className="no-capture"
            >
                {snackbar.message}
            </Notification>
        )}

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', paddingBottom: 0, paddingLeft: 0, paddingRight: 0, width: '100%' }}>
            <Stack gap="sm" style={{ flex: 1, height: '100%' }}>
                <Paper p="xs" withBorder shadow="sm">
                    <Stack>
                        <TextInput
                            label="Plan Keys (comma separated)"
                            placeholder="e.g. PSAT-CIQRRG7, PSAT-ANOTHERPLAN"
                            value={plans}
                            onChange={(e) => setPlans(e.currentTarget.value)}
                            rightSection={<Button size="xs" onClick={() => handleFetchData()} loading={loading}>Pull Data</Button>}
                            rightSectionWidth={100}
                        />
                    </Stack>
                </Paper>

                <Paper p="xs" withBorder shadow="sm">
                    <Group align="flex-end">
                        <DatePickerInput
                            type="range"
                            label="Date Range"
                            valueFormat="YYYY-MM-DD"
                            placeholder="Pick dates"
                            value={dateRange}
                            onChange={setDateRange}
                            style={{ flex: 1 }}
                        />
                        <Select
                            label="Metric"
                            data={METRICS}
                            value={metric}
                            onChange={(v) => v && setMetric(v)}
                            searchable
                            style={{ flex: 1 }}
                        />
                        <Stack gap={0}>
                            <Text size="sm" fw={500} mb={3}>Graph Type</Text>
                            <SegmentedControl
                                value={graphType}
                                onChange={setGraphType}
                                data={[
                                    { label: 'Stacked Bar', value: 'bar' },
                                    { label: 'Stacked Area', value: 'area' },
                                ]}
                            />
                        </Stack>
                    </Group>
                </Paper>

                <Paper ref={chartRef} p={0} withBorder shadow="sm" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'relative', height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 10px' }}>
                        <div className="no-capture" style={{ position: 'absolute', left: 10, top: 10, zIndex: 20, display: 'flex', gap: 5 }}>
                            <ActionIcon onClick={downloadPng} title="Download Chart Image" variant="subtle" color="gray" size="lg">
                                <IconDownload size={20} />
                            </ActionIcon>
                        </div>

                        <div style={{ zIndex: 10 }}>
                            {isEditingTitle ? (
                                <TextInput
                                    value={graphTitle}
                                    onChange={e => setGraphTitle(e.currentTarget.value)}
                                    onBlur={() => setIsEditingTitle(false)}
                                    // Submit on Enter
                                    onKeyDown={(e) => { if (e.key === 'Enter') setIsEditingTitle(false); }}
                                    autoFocus
                                    styles={{ input: { fontSize: '24px', textAlign: 'center', fontWeight: 700, width: 300, height: 'auto', padding: '8px' } }}
                                />
                            ) : (
                                <Paper
                                    p="xs"
                                    onClick={() => setIsEditingTitle(true)}
                                    style={{ cursor: 'text', minWidth: 200, display: 'flex', justifyContent: 'center', backgroundColor: 'transparent', boxShadow: 'none' }}
                                >
                                    <Text fw={700} size="xl">{graphTitle}</Text>
                                </Paper>
                            )}
                        </div>
                    </div>
                    <div style={{ flex: 1, width: '100%', minHeight: 0, marginTop: 0, position: 'relative' }}>
                        {chartData.length > 0 ? (
                            <>
                                <Text size="sm" c="dimmed" style={{ position: 'absolute', top: 0, left: 10, zIndex: 10, lineHeight: '30px' }}>
                                    Plans: {plans.split(',').map(p => p.trim()).filter(Boolean).join(', ')}
                                </Text>
                                <ResponsiveContainer width="100%" height="100%">
                                  <ComposedChart data={chartData} margin={{ top: 10, right: 46, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
                                    <XAxis
                                        dataKey="date"
                                        ticks={xAxisTicks}
                                        interval={0}
                                        minTickGap={30}
                                        tickMargin={8}                                          tick={{ fontSize: 12 }}                                    />
                                    <YAxis
                                        domain={[0, yAxisConfig.domainMax]}
                                        ticks={yAxisConfig.ticks}
                                        tickFormatter={val => (metric === 'percent' || metric === 'fail_percent') ? `${parseFloat((val * 100).toFixed(6))}%` : val}
                                          allowDataOverflow={true}
                                          tick={{ fontSize: 12 }}
                                      >
                                          <Label value={metricLabel || ''} angle={-90} position="insideLeft" style={{ textAnchor: 'middle' }} />
                                      </YAxis>
                                    <Tooltip
                                        formatter={(value: any, name: string, props: any) => {
                                            const payload = props.payload;
                                            if (typeof name === "string" && name.startsWith("Fail_")) return [value, name.replace("Fail_", "")];
                                            if ((name.includes('Percent') || metric === 'percent' || metric === 'fail_percent') && metric !== 'fail_count') {
                                                const originalName = name.replace('Percent', '');
                                                const absValue = payload[originalName];
                                                const ptValue = payload[originalName + 'Percent'];
                                                return [`${(ptValue * 100).toFixed(6)}% (${absValue})`, originalName];
                                            }
                                            // Fallback for count
                                            return [value, name];
                                        }}
                                        itemSorter={() => 1}
                                        contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '8px', border: '1px solid #ccc', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                                    />
                                    <Legend 
                                        verticalAlign="top"
                                        align="right"
                                        wrapperStyle={{ top: 0, right: 10, lineHeight: '30px' }}
                                        formatter={(val) => typeof val === "string" && val.startsWith("Fail_") ? val.replace("Fail_", "") : (typeof val === "string" ? val.replace("Percent", "") : val)}
                                    />

                                    {graphType === 'bar' ? (
                                        <>
                                            {metric !== 'fail_percent' && metric !== 'fail_count' && <Bar dataKey={metric === 'percent' ? "PassPercent" : "Pass"} stackId="a" fill="#2b8a3e" isAnimationActive={false} />}
                                            {metric === 'fail_count' ? (
                                                uniquePlans.map((plan, i) => (
                                                    <Bar key={plan} dataKey={`Fail_${plan}`} stackId="a" fill={PLAN_COLORS[i % PLAN_COLORS.length]} isAnimationActive={false} />
                                                ))
                                            ) : (
                                                <Bar dataKey={(metric === 'percent' || metric === 'fail_percent') ? "FailPercent" : "Fail"} stackId="a" fill="#f59f00" isAnimationActive={false} />
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            {metric !== 'fail_percent' && metric !== 'fail_count' && <Area type="monotone" dataKey={metric === 'percent' ? "PassPercent" : "Pass"} stackId="1" fill="#2b8a3e" stroke="#2b8a3e" isAnimationActive={false} />}
                                            {metric === 'fail_count' ? (
                                                uniquePlans.map((plan, i) => (
                                                    <Area key={plan} type="monotone" dataKey={`Fail_${plan}`} stackId="1" fill={PLAN_COLORS[i % PLAN_COLORS.length]} stroke={PLAN_COLORS[i % PLAN_COLORS.length]} isAnimationActive={false} />
                                                ))
                                            ) : (
                                                <Area type="monotone" dataKey={(metric === 'percent' || metric === 'fail_percent') ? "FailPercent" : "Fail"} stackId="1" fill="#f59f00" stroke="#f59f00" isAnimationActive={false} />
                                            )}
                                        </>
                                    )}
                                </ComposedChart>
                            </ResponsiveContainer>
                            </>
                        ) : (
                            <Group justify="center" align="center" style={{ height: '100%' }}>
                                <Text c="dimmed">No data available. Adjust dates or click Pull Data.</Text>
                            </Group>
                        )}
                    </div>
                </Paper>
            </Stack>
        </div>
      </AppShell.Main>
    </AppShell>
  );
}
