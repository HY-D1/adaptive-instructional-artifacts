// Keep the legacy db:migrate command on the same guarded, idempotent Neon
// provisioning path as db:init:neon.
import './init-neon.js';
