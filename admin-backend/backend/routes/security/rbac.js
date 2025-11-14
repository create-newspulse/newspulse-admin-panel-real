// backend/routes/security/rbac.js
// RBAC (Role-Based Access Control) Management

import express from 'express';
const router = express.Router();

// Define roles and permissions
const ROLES = {
  founder: {
    name: 'Founder',
    permissions: ['*'], // Full access
    description: 'Complete system access',
  },
  admin: {
    name: 'Admin',
    permissions: [
      'story.create',
      'story.edit',
      'story.delete',
      'story.publish',
      'user.view',
      'user.edit',
      'category.manage',
      'media.manage',
      'settings.view',
    ],
    description: 'Full editorial and user management',
  },
  managing_editor: {
    name: 'Managing Editor',
    permissions: ['story.create', 'story.edit', 'story.publish', 'story.delete', 'category.manage', 'media.manage'],
    description: 'Editorial control and content management',
  },
  section_editor: {
    name: 'Section Editor',
    permissions: ['story.create', 'story.edit', 'story.publish', 'media.upload'],
    description: 'Section-level editorial rights',
  },
  copy_desk: {
    name: 'Copy Desk',
    permissions: ['story.edit', 'story.view'],
    description: 'Review and edit stories',
  },
  contributor: {
    name: 'Contributor',
    permissions: ['story.create', 'story.view'],
    description: 'Submit stories for review',
  },
  sales: {
    name: 'Sales',
    permissions: ['sponsored.create', 'sponsored.view', 'analytics.view'],
    description: 'Manage sponsored content',
  },
};

const userRoles = [
  { userId: 'u1', email: 'founder@newspulse.com', role: 'founder' },
  { userId: 'u2', email: 'editor@newspulse.com', role: 'managing_editor' },
  { userId: 'u3', email: 'copy@newspulse.com', role: 'copy_desk' },
  { userId: 'u4', email: 'contributor@newspulse.com', role: 'contributor' },
];

/**
 * Get all roles and their permissions
 * GET /api/security/rbac/roles
 */
router.get('/roles', (req, res) => {
  return res.json({ success: true, roles: ROLES });
});

/**
 * Get user roles
 * GET /api/security/rbac/users
 */
router.get('/users', (req, res) => {
  const enriched = userRoles.map((u) => ({
    ...u,
    roleName: ROLES[u.role]?.name || 'Unknown',
    permissions: ROLES[u.role]?.permissions || [],
  }));
  return res.json({ success: true, users: enriched });
});

/**
 * Check permission
 * POST /api/security/rbac/check
 * Body: { userId, permission }
 */
router.post('/check', (req, res) => {
  const { userId, permission } = req.body;

  const user = userRoles.find((u) => u.userId === userId);
  if (!user) {
    return res.json({ success: true, allowed: false, reason: 'User not found' });
  }

  const rolePerms = ROLES[user.role]?.permissions || [];
  const allowed = rolePerms.includes('*') || rolePerms.includes(permission);

  return res.json({ success: true, allowed, role: user.role, permission });
});

/**
 * Assign role to user
 * POST /api/security/rbac/assign
 * Body: { userId, email, role }
 */
router.post('/assign', (req, res) => {
  const { userId, email, role } = req.body;

  if (!userId || !email || !role) {
    return res.status(400).json({ success: false, message: 'Missing userId, email, or role' });
  }

  if (!ROLES[role]) {
    return res.status(400).json({ success: false, message: 'Invalid role' });
  }

  const existingIdx = userRoles.findIndex((u) => u.userId === userId);
  if (existingIdx !== -1) {
    userRoles[existingIdx].role = role;
  } else {
    userRoles.push({ userId, email, role });
  }

  return res.json({ success: true, message: 'Role assigned', user: { userId, email, role } });
});

/**
 * Get permission matrix (all roles x all permissions)
 * GET /api/security/rbac/matrix
 */
router.get('/matrix', (req, res) => {
  const allPermissions = new Set();
  Object.values(ROLES).forEach((r) => {
    r.permissions.forEach((p) => {
      if (p !== '*') allPermissions.add(p);
    });
  });

  const matrix = {};
  Object.keys(ROLES).forEach((roleKey) => {
    const perms = ROLES[roleKey].permissions;
    matrix[roleKey] = {};
    allPermissions.forEach((perm) => {
      matrix[roleKey][perm] = perms.includes('*') || perms.includes(perm);
    });
  });

  return res.json({ success: true, permissions: Array.from(allPermissions), matrix });
});

export default router;
