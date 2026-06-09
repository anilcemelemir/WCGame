import { useMemo } from "react";

export type MatchAnimationType = "whistle" | "goal" | "miss" | "post" | "yellow-card" | "red-card";

type ShotVariant = "goal-1" | "goal-2" | "goal-3" | "post-1" | "post-2" | "out-1" | "out-2";

interface MatchEventAnimationProps {
  type: MatchAnimationType | null;
}

export function MatchEventAnimation({ type }: MatchEventAnimationProps) {
  const shotVariant = useMemo<ShotVariant | null>(() => {
    if (type === "goal") return randomItem(["goal-1", "goal-2", "goal-3"]);
    if (type === "post") return randomItem(["post-1", "post-2"]);
    if (type === "miss") return randomItem(["out-1", "out-2"]);
    return null;
  }, [type]);

  if (!type) return null;

  return (
    <div className={`match-animation match-animation--${type} play`} key={`${type}-${shotVariant ?? "base"}`}>
      {(type === "yellow-card" || type === "red-card") && (
        <div className="match-animation__scene">
          <div className="referee-arm-container">
            <div className={type === "yellow-card" ? "card yellow-card" : "card red-card"} />
            <div className="referee-hand" />
            <div className="referee-arm" />
          </div>
        </div>
      )}

      {type === "whistle" && (
        <div className="match-animation__scene whistle-scene">
          <div className="whistle-wrapper">
            <div className="real-whistle">
              <div className="ring" />
              <div className="barrel" />
              <div className="mouthpiece" />
            </div>
          </div>
          <div className="sound-waves">
            <span className="wave w1" />
            <span className="wave w2" />
            <span className="wave w3" />
          </div>
        </div>
      )}

      {shotVariant && (
        <div className={`match-animation__scene shot-scene shot-scene--${type} shot-scene--${shotVariant}`}>
          <div className={`full-goal ${type === "goal" ? "goal-anim" : type === "post" ? "post-anim" : "out-anim"}`}>
            <div className="goal-net" />
            <div className="post-left" />
            <div className="post-right" />
            <div className="crossbar" />
          </div>
          <div className={`ball ball-${shotVariant}`}>{"\u26bd"}</div>
          <div className={`text-burst ${type}-text`}>{resultText(type, shotVariant)}</div>
        </div>
      )}
    </div>
  );
}

function randomItem<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function resultText(type: MatchAnimationType, variant: ShotVariant) {
  if (type === "goal") return variant === "goal-2" ? "HAR\u0130KA!" : "GOL!";
  if (type === "post") return "D\u0130REK!";
  return "KA\u00c7TI!";
}
