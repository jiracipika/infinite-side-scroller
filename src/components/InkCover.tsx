import CharacterSprite from './CharacterSprite';
import styles from './StartScreen.module.css';

/** Ruined-world backdrop with the same redesigned cast used in gameplay. */
export default function InkCover({ characterId = 'knight' }: { characterId?: string }) {
  return (
    <div className={styles.cover} data-ink-cover aria-hidden="true">
      <svg viewBox="0 0 600 360" preserveAspectRatio="xMidYMid slice" focusable="false">
        <defs>
          <pattern id="cover-dots" width="8" height="8" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.1" fill="#171022" />
          </pattern>
          <pattern id="cover-hatch" width="13" height="13" patternUnits="userSpaceOnUse" patternTransform="rotate(28)">
            <path d="M0 0V13" stroke="#8061b0" strokeWidth="2" />
          </pattern>
        </defs>
        <path fill="#191725" d="M0 0H600V360H0z" />
        <path fill="#30233f" d="M0 268 120 10 370 0 600 45 600 360H0z" />
        <path fill="#46315e" d="m126 294 188-256 187-38 99 59v301z" />
        <path fill="url(#cover-dots)" d="M0 0H600V360H0z" />
        <g className={styles.coverMoon}>
          <path fill="#c295ec" stroke="#211030" strokeWidth="3" d="m401 35 39-9 24 11 20 22 5 30-17 40-35 24-41-5-26-23-13-30 12-35z" />
          <path fill="#8a51b6" d="m380 55 30-12 13 25-14 16-29-5zm67 35 27-18-4 33-22 27-22-4z" />
          <path fill="#191725" d="m425 22-14 44 21 11-24 47 29 34-15-38 29-51-24-9 14-32z" />
          <path fill="#d5acf5" d="m478 26 18 4-7 14-18-4zm-113 99-13 11 9 15 14-14zm62 43 18 5-9 12-14-7z" />
        </g>
        <g className={styles.coverCity} fill="#241134" stroke="#68348c" strokeWidth="2">
          <path d="M-20 350V128H1V91H9V129H33V113H56V180H79V150H90V110H97V151H112V218H131V165H146V130H154V165H174V226H202V192H232V166H240V204H263V350z" />
          <path d="M339 350V198H357V147H372V116H380V148H393V187H412V235H431V131H443V90H451V133H479V169H497V223H514V179H525V153H533V180H552V209H570V124H583V100H590V125H612V350z" />
        </g>
        <g fill="#9450bf">
          <path d="M16 146h6v18h-6zm20 0h6v18h-6zm61 28h5v15h-5zm55 12h6v16h-6zm219-14h6v17h-6zm75-19h7v13h-7zm17 0h7v13h-7zm121-5h6v17h-6z" />
          <path d="M32 185h20v53H32zm408-3h22v51h-22z" />
        </g>
        <g stroke="#d4a9f8" strokeWidth="2">
          <path d="M37 194h10m-5-5v15m-5 7h10m-10 7h10m-8 5v8m398-41h12m-6-5v19m-6 7h12m-12 7h12m-9 6h8" />
        </g>
        <g fill="#08090d" stroke="#9570ff" strokeWidth="2">
          <path d="M-6 309 53 297 80 309 128 295 158 301 158 360H-6z" />
          <path d="m430 290 49-11 47 6 16-11 64 6v80H430z" />
        </g>
        <path fill="url(#cover-hatch)" d="M0 319H145V360H0zm441-20h159v61H441z" />
        <path d="m0 306 54-8 26 12 48-15 30 6m272-11 49-11 47 6 16-11 58 5" fill="none" stroke="#c7ff4d" strokeWidth="4" />
        <g fill="#c7ff4d">
          <path d="m60 86 34-11-24 14zm116 169 31-15-20 19zm283-29 30-15-19 23zM269 74l8-18 5 12 13 2-18 5-3 11z" />
        </g>
        <g stroke="#ad73d4" strokeWidth="1.5">
          <path d="m0 83 81-32M0 101l60-24m469 159 111-45m-96 55 116-44M63 279l73-35M213 35l62-25" />
        </g>
        <path d="M0 6 158 0M0 350l112 10m488-10-159 10M600 3l-53 2" fill="none" stroke="#f4f2ed" strokeWidth="3" />
      </svg>
      <div className={styles.coverParty}>
        <div className={styles.coverCompanion}><CharacterSprite characterId={characterId === 'ranger' ? 'spirit' : 'ranger'} size={132} decorative /></div>
        <div className={styles.coverHero}><CharacterSprite characterId={characterId} size={192} animated decorative /></div>
        <div className={styles.coverCompanion}><CharacterSprite characterId={characterId === 'mage' ? 'healer' : 'mage'} size={132} decorative facingRight={false} /></div>
      </div>
      <div className={styles.coverCaption}><span>A WORLD WORTH RUNNING</span><span>YOUR PARTY. YOUR PATH.</span></div>
    </div>
  );
}
