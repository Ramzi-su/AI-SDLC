'use client';

import { useState } from 'react';
import { useProjectStore } from '@/store/projectStore';
import ProjectWizard from '@/components/wizard/ProjectWizard';
import RequireAuth from '@/components/auth/RequireAuth';

export default function NewProjectPage() {
  // Clear any previously opened project before the first render, so it never flashes.
  useState(() => {
    useProjectStore.getState().reset();
    return true;
  });

  return (
    <RequireAuth>
      <ProjectWizard />
    </RequireAuth>
  );
}
