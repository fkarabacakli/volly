import type { Messages } from "../tr";

export const activityLog: Messages["activityLog"] = {
  title: "Live activity",
  description: "Full event log streamed from the API over Server-Sent Events.",
  streaming: "streaming",
  offline: "offline",
  listening: "Listening for activity",
  noEvents: "No events yet",
  openBody: "The stream is open. Events will appear here as the backend publishes them.",
  closedBody: "The activity stream is not connected. Events will queue once the connection comes online.",
  events: "Activity events",
  colAction: "Action",
  colEntity: "Entity",
  colTime: "Time",
};
