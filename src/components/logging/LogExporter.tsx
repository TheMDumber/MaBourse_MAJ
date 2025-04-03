import React, { useState } from 'react';
import { getLogger, downloadLogs } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

type LogExporterProps = {
  className?: string;
};

type LogFormat = 'json' | 'csv' | 'txt';

const LogExporter: React.FC<LogExporterProps> = ({ className }) => {
  const [format, setFormat] = useState<LogFormat>('json');
  const [activeTab, setActiveTab] = useState('export');
  
  const logger = getLogger();
  const logs = logger.getLogs();

  const handleExport = () => {
    try {
      downloadLogs(format);
    } catch (error) {
      console.error('Error exporting logs:', error);
    }
  };

  const handleClearLogs = () => {
    if (window.confirm('Êtes-vous sûr de vouloir effacer tous les journaux ?')) {
      logger.clear();
      // Force refresh
      setActiveTab('export');
      setTimeout(() => setActiveTab('view'), 10);
    }
  };

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'DEBUG': return 'bg-gray-500';
      case 'INFO': return 'bg-blue-500';
      case 'WARNING': return 'bg-yellow-500';
      case 'ERROR': return 'bg-red-500';
      case 'CRITICAL': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Journaux d'application</CardTitle>
        <CardDescription>
          Visualisez ou exportez les journaux de l'application
        </CardDescription>
      </CardHeader>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mx-4">
          <TabsTrigger value="export">Exporter</TabsTrigger>
          <TabsTrigger value="view">Visualiser</TabsTrigger>
        </TabsList>
        
        <TabsContent value="export" className="p-4">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-sm font-medium mb-2">Format d'exportation</p>
                <Select value={format} onValueChange={(value) => setFormat(value as LogFormat)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choisir un format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="json">JSON</SelectItem>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="txt">Texte brut (.TXT)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground">
                  {logs.length} entrées de journal au total
                </p>
              </div>
            </div>
          </CardContent>
          
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={handleClearLogs}>
              Effacer les journaux
            </Button>
            <Button onClick={handleExport}>
              Télécharger les journaux
            </Button>
          </CardFooter>
        </TabsContent>
        
        <TabsContent value="view" className="p-4">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4">
              <ScrollArea className="h-[300px] w-full rounded-md border p-4">
                {logs.length === 0 ? (
                  <p className="text-center text-muted-foreground">Aucun journal disponible</p>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className="mb-2 pb-2 border-b last:border-b-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={getLogLevelColor(log.level)}>{log.level}</Badge>
                        <span className="text-xs text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</span>
                        {log.module && (
                          <Badge variant="outline" className="ml-auto">{log.module}</Badge>
                        )}
                      </div>
                      <p className="text-sm">{log.message}</p>
                    </div>
                  ))
                )}
              </ScrollArea>
            </div>
          </CardContent>
          
          <CardFooter className="flex justify-end">
            <Button variant="outline" onClick={handleClearLogs}>
              Effacer les journaux
            </Button>
          </CardFooter>
        </TabsContent>
      </Tabs>
    </Card>
  );
};

export default LogExporter;
