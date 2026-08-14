/**
 * Strip the aps-environment (remote push) entitlement that expo-notifications
 * adds. Local notifications (practice reminders, in-app scheduling) don't need
 * it, and our cached App Store provisioning profile predates the Push
 * capability — re-issuing requires an interactive Apple login. Remove this
 * plugin when remote push ships and credentials are regenerated.
 */
const { withEntitlementsPlist } = require("@expo/config-plugins");

module.exports = function withoutRemotePush(config) {
  return withEntitlementsPlist(config, (c) => {
    delete c.modResults["aps-environment"];
    return c;
  });
};
