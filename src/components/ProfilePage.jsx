import { useRef } from 'react';
import Avatar from './Avatar.jsx';
import ProfileForm from './ProfileForm.jsx';
import { profileCompletion } from '../profile.js';
import { gsap, useGSAP, usePageIntro, MOTION_OK } from '../motion.js';

export default function ProfilePage({ me, onSaved }) {
  const { done, total } = profileCompletion(me);
  const scope = usePageIntro();
  const bar = useRef(null);
  // La jauge se remplit segment par segment.
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      gsap.from(bar.current.querySelectorAll('.on'), {
        scaleX: 0,
        transformOrigin: 'left center',
        duration: 0.5,
        ease: 'power3.out',
        stagger: 0.12,
        delay: 0.35,
      });
    });
  }, { scope: bar, dependencies: [done] });
  return (
    <div className="bento-page" ref={scope}>
      <header className="tile tile-profile-hero">
        <div className="profile-header">
          <Avatar name={me.name} index={me.id} size="lg" />
          <div>
            <h1 className="title">{me.name}</h1>
            <p className="muted">{me.email}</p>
          </div>
        </div>
        <div className="meter" aria-label={`Profil rempli à ${done} sur ${total}`}>
          <p className="meter-text"><span className="num">{done}/{total}</span> {done === total ? 'profil complet, bravo' : 'rubriques remplies'}</p>
          <div className="meter-bar" ref={bar}>
            {Array.from({ length: total }, (_, i) => <span key={i} className={i < done ? 'on' : ''} />)}
          </div>
        </div>
      </header>

      <section className="tile tile-form">
        <h2 className="section-title">Ce que la famille sait de toi</h2>
        <p className="muted small">Plus c’est précis, meilleures seront les idées qu’on te trouvera.</p>
        <ProfileForm initial={me} onSaved={onSaved} />
      </section>
    </div>
  );
}
