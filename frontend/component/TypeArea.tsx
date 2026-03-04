import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import useStore from "../store";

interface IProps extends React.ComponentProps<"div"> {
	text: string;
	isOverlayed: boolean;
	onStart?: () => void;
	onFinish?: () => void;
}

export default function TypingArea({
	text,
	isOverlayed,
	onStart,
	onFinish,
	...props
}: IProps) {
	const words = text.split(" ");

	const [currWordIdx, setCurrWordIdx] = useState(0);
	const [currLetterIdx, setCurrLetterIdx] = useState(0);
	const [charCount, setCharCount] = useState(0);
	const [typos, setTypos] = useState(new Set<`${number},${number}`>()); // "wordIdx-letterIdx"

	const incrStat = useStore((state) => state.incrStat);
	const typedCharCount = useStore((state) => state.stats.typedCharCount);
	const caseSensitive = useStore((state) => state.config.caseSensitive);

	const typeAreaRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!isOverlayed) typeAreaRef.current?.focus();
	}, [isOverlayed]);

	useEffect(() => {
		setCurrLetterIdx(0);
		setCurrWordIdx(0);
		setTypos(new Set<`${number},${number}`>());
	}, [text]);

	const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
		// Delete only until the beginning of the word
		if (e.key === "Backspace") {
			if (typos.has(`${currWordIdx},${currLetterIdx - 1}`)) {
				setTypos((prev) => {
					prev.delete(`${currWordIdx},${currLetterIdx - 1}`);
					return new Set(prev);
				});
			}
			if (currLetterIdx !== 0) setCurrLetterIdx((curr) => curr - 1);
			setCharCount((c) => c - 1);
			return;
		}

		// prevent default behaviours of all keys except letters
		if (e.key.length !== 1) return;

		const word = caseSensitive
			? words[currWordIdx]
			: words[currWordIdx].toLowerCase();
		const typedLetter = caseSensitive ? e.key : e.key.toLowerCase();

		// Initial letter
		if (currLetterIdx === 0 && currWordIdx === 0) {
			onStart?.();
		}
		if (currLetterIdx === word.length - 1 && currWordIdx === words.length - 1) {
			onFinish?.();
		}

		// Word complete: handle space key
		if (currLetterIdx === word.length) {
			if (typedLetter !== " ") return;
			setCurrWordIdx((i) => i + 1);
			setCurrLetterIdx(0);
			incrStat("wordCount");
			return;
		}

		// Typos
		if (word[currLetterIdx] !== typedLetter) {
			setTypos((prev) => prev.add(`${currWordIdx},${currLetterIdx}`));
			incrStat("typos");
		}

		// Progressing
		if (charCount >= typedCharCount) incrStat("typedCharCount");

		setCurrLetterIdx((i) => i + 1);
		setCharCount((c) => c + 1);
	};

	return (
		<div
			ref={typeAreaRef}
			onKeyDown={handleKeyDown}
			role="textbox"
			tabIndex={0}
			className="flex flex-wrap focus:outline-none relative font-mono text-3xl"
			{...props}
		>
			{words.map((word, widx) => {
				const isCurrWord = widx === currWordIdx && currLetterIdx < word.length;
				return (
					<div
						key={word + widx}
						className={clsx(
							"z-10 relative px-2.5 py-1 rounded-md transition-all",
							widx > currWordIdx && "text-neutral-600",
							widx < currWordIdx && "text-neutral-100",
						)}
					>
						{/* Word */}
						{word.split("").map((ltr, lidx) => {
							const isTypo = typos.has(`${widx},${lidx}`);
							const isCorrect = lidx < currLetterIdx && isCurrWord && !isTypo;
							return (
								<span
									key={ltr + lidx}
									className={clsx(
										isTypo && "text-red-500",
										isCorrect && "text-sky-400",
									)}
								>
									{ltr}
								</span>
							);
						})}
						{/* Current word indicator */}
						<div
							className={clsx(
								"absolute transition-all inset-0 bg-neutral-800 rounded-md -z-10 origin-left",
								isCurrWord ? "scale-x-100" : "scale-x-0",
							)}
						/>
						{/* Cursor / Caret */}
						{isCurrWord && (
							<div
								className="transition-all duration-100 rounded ease-linear absolute h-9 left-1.5 w-0.5 top-1 bg-yellow-400"
								style={{ left: `${8 + currLetterIdx * 18.15}px` }}
							/>
						)}
						{/* Spacebar indicator */}
						{widx === currWordIdx && currWordIdx !== words.length - 1 && (
							<div
								className={clsx(
									"absolute top-0 -right-2 transition-opacity duration-500 bg-neutral-800 h-full px-2 rounded",
									currLetterIdx === word.length ? "opacity-100" : "opacity-0",
								)}
							/>
						)}
					</div>
				);
			})}
		</div>
	);
}