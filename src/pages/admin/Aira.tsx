import React from 'react';
import AiraVoicePlayer from '../../components/AiraVoicePlayer';

const AiraPage: React.FC = () => {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">AIRA – AI Anchor Voice Bulletins</h1>
      <p className="opacity-80 mb-4">Generate and play hourly voice bulletins. If server TTS is not configured, playback uses your browser voice.</p>
      <AiraVoicePlayer />
    </div>
  );
};

export default AiraPage;
