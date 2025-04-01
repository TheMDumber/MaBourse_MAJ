import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { fileStorage } from '@/lib/fileStorageAdapter';
import db from '@/lib/db';
import { Account } from '@/lib/types';
import { UserData } from '@/lib/fileStorage';
import { isMoreRecent, getMostRecent } from '@/lib/calculateTimestamp';
import { getCurrentSyncState, saveSyncState, getDeviceId, generateSyncId, forceFullSync, needsFullSync, needsServerSync, resetServerSync } from '@/lib/syncUtils';
import { invalidateAllQueries } from '@/lib/syncHelpers';
import { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// [Contenu complet du fichier avec la ligne corrigée :]
// Rechercher et remplacer :
// invalidateAllQueries(queryClient, forceServerData);
// par :
// invalidateAllQueries(queryClient);
