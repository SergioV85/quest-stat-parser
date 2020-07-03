export interface CodeEntry {
  GameId: number;
  code: string | number;
  isRemovedLevel: boolean;
  isSuccess: boolean;
  isTimeout: boolean;
  isDuplicate: boolean;
  level: number;
  teamId: number;
  teamName: string;
  time: string;
  timeDiff: number | null;
  userId: number;
  userName: string;
  _id: string;
}
interface GroupData {
  codesCounts: number;
  correctCodesPercent: number;
  correctCodesQuantity: number;
}
export interface MonitoringLevelData extends GroupData {
  _id: {
    level: number;
    teamId: number;
  };
}
export interface MonitoringTeamGroupedData extends GroupData {
  _id: {
    teamId: number;
    teamName: string;
  };
}
export interface MonitoringTeamDetailedData {
  parsed: boolean;
  dataByLevel?: MonitoringLevelData[];
  dataByUser?: PlayerGroupedData[];
}
export interface PlayerGroupedData extends GroupData {
  _id: {
    userId: number;
    userName: string;
  };
}
export interface PlayerLevelData extends GroupData {
  _id: {
    level: number;
    userId: number;
  };
}
export interface DetailedMonitoringRequest {
  gameId: number;
  playerId?: number;
  teamId?: number;
  levelId?: number;
  detailsType: string;
}
export interface MonitoringStatus {
  gotError?: boolean;
  error?: Error;
  pageSaved: number;
  parsed: boolean;
  totalPages: number;
}

export type AggregatedMonitoringData =
  | MonitoringTeamGroupedData
  | PlayerLevelData
  | MonitoringLevelData
  | PlayerGroupedData;

export interface MonitoringResponse extends MonitoringStatus {
  GameId?: number;
  _id?: number;
  totalData: AggregatedMonitoringData[];
  dataByLevel?: MonitoringLevelData[];
  dataByUser?: PlayerGroupedData[];
}
export interface CodesListRequest {
  GameId?: number;
  userId?: number;
  teamId?: number;
  level: number;
  type: string;
}
export type CodesListResponse = CodeEntry[];

export enum CodesRequestToDbType {
  LEVEL = 'teamLevel',
  TEAM = 'teamPlayer',
  PLAYER = 'playerLevel',
}

interface MongoRequestMatch {
  [key: string]: string | number | boolean | { $eq: number | string };
}

export interface MongoRequest {
  $match?: { $and: MongoRequestMatch[] } | MongoRequestMatch;
  $group?: {
    [key: string]: {
      [key: string]: string;
    };
  };
  $project?: {
    [key: string]: {
      [key: string]: string;
    };
  };
  $sort?: {
    [key: string]: number;
  };
}
