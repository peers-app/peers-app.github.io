import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

/** Order is explicit: edit this list to change the left nav. */
const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    "index",
    "building-packages",
    "project-stack.diagram",
    "peer-device-group-architecture",
    "decentralized-architecture-faq",
    "user-groups.diagram",
    "devices",
    {
      type: "category",
      label: "Connections",
      items: [
        "connections/architecture",
        "connections/socket-io-connections",
        "connections/webrtc-signaling",
        "connections/webrtc-testing",
      ],
    },
    "groups-mvp",
    "groups-and-members",
    "group-share",
    "dependency-injection",
    "cross-group-operations-test",
    "workflow-run-assignment",
    "table-access-patterns",
    "push-notifications",
    "user-update",
  ],
};

export default sidebars;
