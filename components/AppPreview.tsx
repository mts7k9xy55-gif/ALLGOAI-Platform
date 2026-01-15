'use client'

import WebContainerPreview from './WebContainerPreview'

interface AppPreviewProps {
  githubRepoUrl?: string
  zipFileUrl?: string
  appId: string
  onPreviewStart?: () => Promise<boolean> | boolean
}

export default function AppPreview({ githubRepoUrl, zipFileUrl, appId, onPreviewStart }: AppPreviewProps) {
  return (
    <WebContainerPreview
      githubRepoUrl={githubRepoUrl}
      zipFileUrl={zipFileUrl}
      appId={appId}
      onPreviewStart={onPreviewStart}
    />
  )
}
