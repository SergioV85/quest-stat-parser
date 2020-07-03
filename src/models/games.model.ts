export interface GroupedTeamData {
  id: number;
  data: TeamData[];
}

export interface LevelData {
  level: number | string;
  name: string;
  position: number;
  removed: boolean;
  type?: number;
}

export interface TeamData {
  bestTime?: boolean;
  closedLevels?: number;
  duration: number;
  extraBonus?: number;
  id: number;
  levelIdx: number | null;
  levelTime: string;
  name: string;
  additionsTime?: number;
  timeout?: boolean;
}

export interface GameInfo {
  _id?: number;
  Domain: string;
  FinishTime: string;
  GameId: number;
  GameName: string;
  StartTime: string;
  Timezone: string;
}

export interface GameData {
  info: GameInfo;
  stat: {
    DataByTeam: GroupedTeamData[];
    DataByLevels: TeamData[][];
    FinishResults: TeamData[];
    Levels: LevelData[];
  };
}

export type AggregatedGameData = GameInfo & GameData['stat'];

export interface GameRequest {
  gameId: number;
  domain: string;
  isForceRefresh?: boolean;
}
