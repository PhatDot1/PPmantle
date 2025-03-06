"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  BookOpen,
  Info,
  X,
  Send,
  Github,
  Twitter,
  Linkedin,
  Menu,
  Home,
  HelpCircle,
  User,
  Trophy,
  Star,
  Award,
  Crown,
  Sparkles,
} from "lucide-react"

export default function WordGuessingGame() {
  // Updated state: each guess now holds scoreDisplay and progressPercent.
  const [guess, setGuess] = useState("")
  const [guesses, setGuesses] = useState<
    { word: string; scoreDisplay: string; progressPercent: number; order: number; isTop1000: boolean }[]
  >([])
  const [guessCount, setGuessCount] = useState(0)
  const [showInstructions, setShowInstructions] = useState(false)
  const [feedback, setFeedback] = useState<{
    message: string
    type: "success" | "info" | "error"
  } | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showCelebration, setShowCelebration] = useState(false)
  const [celebrationWord, setCelebrationWord] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  // Handle guess submission by calling the backend API route
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!guess.trim()) {
      setFeedback({
        message: "Please enter a word",
        type: "error",
      })
      return
    }

    const guessLower = guess.trim().toLowerCase()

    // Duplicate guess check: if the word has already been guessed, notify the user.
    if (guesses.some(item => item.word.toLowerCase() === guessLower)) {
      setFeedback({
        message: "You have already guessed that word you stinky nerd",
        type: "info",
      })
      return
    }

    try {
      // Call the API route (/api/rank) with the guess.
      const response = await fetch("/api/rank", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ guess }),
      })

      const data = await response.json()

      if (!response.ok) {
        setFeedback({
          message: data.error || "An error occurred",
          type: "error",
        })
        return
      }

      let scoreDisplay: string
      let progressPercent: number
      let isTop1000 = false
      let rank: number | null = null

      if (data.rank !== null && data.rank !== undefined) {
        // If the API returns a rank (i.e. the word is in the precomputed ranking),
        // display it as "X/1000" and compute a progress percentage inversely.
        rank = data.rank
        scoreDisplay = `${data.rank}/1000`
        progressPercent = Math.round(((1000 - data.rank) / 1000) * 100)
        isTop1000 = true

        // Show celebration for top 100 words
        if (data.rank <= 100) {
          setShowCelebration(true)
          setCelebrationWord(guess)
          setTimeout(() => setShowCelebration(false), 3000)
        }
      } else if (data.closeness !== null && data.closeness !== undefined) {
        // Otherwise, if closeness is provided (a value between 0 and 1),
        // display it as an arbitrary number (without %)
        // Multiply by 3 to make the scale warmer
        const closenessValue = Math.round(data.closeness * 100 * 3)
        // Cap at 100 for the progress bar
        progressPercent = Math.min(closenessValue, 100)
        // Display the raw value (can exceed 100)
        scoreDisplay = `${closenessValue}`
      } else {
        scoreDisplay = ""
        progressPercent = 0
      }

      // Increase guess count and update guesses list
      const newGuessCount = guessCount + 1
      const newGuess = {
        word: guess,
        scoreDisplay,
        progressPercent,
        order: newGuessCount,
        isTop1000,
        rank, // Store the rank for sorting
      }

      // We keep the guesses in the order they were submitted
      const updatedGuesses = [...guesses, newGuess]

      setGuesses(updatedGuesses)
      setGuessCount(newGuessCount)
      setGuess("")

      // Provide feedback based on progressPercent.
      if (progressPercent >= 99) {
        setFeedback({
          message: "You have found the exact word! 🤓 get a life",
          type: "success",
        })
      } else if (progressPercent > 90) {
        setFeedback({
          message: "You are extremely close! 🗜🤏🔒😫",
          type: "success",
        })
      } else if (progressPercent > 70) {
        setFeedback({
          message: "You are getting warmer! 🔥",
          type: "success",
        })
      } else if (progressPercent > 40) {
        setFeedback({
          message: "You are on the right track 🛤️",
          type: "info",
        })
      } else {
        setFeedback({
          message: "Try a different word dumbass",
          type: "info",
        })
      }

      // Auto-focus the input after submission
      if (inputRef.current) {
        inputRef.current.focus()
      }
    } catch (error) {
      console.error("Error submitting guess:", error)
      setFeedback({
        message: "An error occurred. Please try again.",
        type: "error",
      })
    }
  }

  // Clear feedback after 3 seconds
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => {
        setFeedback(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [feedback])

  // Scroll to section function for navigation
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: "smooth" })
    }
    setMobileMenuOpen(false)
  }

  // Function to get the appropriate icon based on rank
  const getRankIcon = (scoreDisplay: string) => {
    if (!scoreDisplay.includes("/1000")) return null

    const rank = Number.parseInt(scoreDisplay.split("/")[0])

    if (rank <= 10) return <Crown className="text-yellow-500" />
    if (rank <= 50) return <Trophy className="text-amber-500" />
    if (rank <= 200) return <Award className="text-blue-500" />
    if (rank <= 500) return <Star className="text-green-500" />

    return <Sparkles className="text-gray-500" />
  }

  // Function to get temperature emoji based on closeness percentage
  const getTemperatureEmoji = (progressPercent: number) => {
    if (progressPercent >= 80) return "🔥" // Fire - very hot (close)
    if (progressPercent >= 60) return "🌶️" // Hot pepper - hot
    if (progressPercent >= 40) return "☀️" // Sun - warm
    if (progressPercent >= 20) return "❄️" // Snowflake - cold
    return "🧊" // Ice cube - very cold (far)
  }

  // Function to sort guesses by closeness
  const sortGuessesByCloseness = (
    guesses: { word: string; scoreDisplay: string; progressPercent: number; order: number; isTop1000: boolean }[],
    latestGuessOrder: number
  ) => {
    return [...guesses].sort((a, b) => {
      // Always put the most recent guess at the top
      if (a.order === latestGuessOrder) return -1
      if (b.order === latestGuessOrder) return 1

      // Top 1000 words always come before non-top 1000 words
      if (a.isTop1000 && !b.isTop1000) return -1
      if (!a.isTop1000 && b.isTop1000) return 1

      // For top 1000 words, sort by rank (lower rank = closer)
      if (a.isTop1000 && b.isTop1000) {
        const rankA = Number.parseInt(a.scoreDisplay.split("/")[0])
        const rankB = Number.parseInt(b.scoreDisplay.split("/")[0])
        return rankA - rankB
      }

      // For non-top 1000 words, sort by progressPercent (higher = closer)
      return b.progressPercent - a.progressPercent
    })
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 text-gray-800">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white shadow-md">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <motion.div
            className="flex items-center space-x-2"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="h-10 w-10 rounded-full bg-gradient-to-r from-green-400 to-green-600 flex items-center justify-center text-white font-bold text-xl">
              P
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-500 to-blue-500">
              PPmantle
            </h1>
          </motion.div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            {["Home", "How It Works", "About"].map((item) => (
              <motion.button
                key={item}
                className="text-gray-600 hover:text-green-500 transition-colors relative group"
                onClick={() => scrollToSection(item.toLowerCase().replace(/\s+/g, "-"))}
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
              >
                {item}
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-green-500 transition-all duration-300 group-hover:w-full"></span>
              </motion.button>
            ))}
          </nav>

          {/* Mobile Menu Button */}
          <motion.button
            className="md:hidden text-gray-600"
            whileTap={{ scale: 0.9 }}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <Menu size={24} />
          </motion.button>
        </div>

        {/* Mobile Navigation */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              className="md:hidden bg-white absolute w-full shadow-lg"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="container mx-auto px-4 py-3 flex flex-col space-y-3">
                <motion.button
                  className="flex items-center space-x-2 text-gray-600 hover:text-green-500 transition-colors"
                  onClick={() => scrollToSection("home")}
                  whileTap={{ scale: 0.95 }}
                >
                  <Home size={18} />
                  <span>Home</span>
                </motion.button>
                <motion.button
                  className="flex items-center space-x-2 text-gray-600 hover:text-green-500 transition-colors"
                  onClick={() => scrollToSection("how-it-works")}
                  whileTap={{ scale: 0.95 }}
                >
                  <HelpCircle size={18} />
                  <span>How It Works</span>
                </motion.button>
                <motion.button
                  className="flex items-center space-x-2 text-gray-600 hover:text-green-500 transition-colors"
                  onClick={() => scrollToSection("about")}
                  whileTap={{ scale: 0.95 }}
                >
                  <User size={18} />
                  <span>About</span>
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="flex-grow container mx-auto px-4 py-8" id="home">
        {/* Game Section */}
        <motion.section
          className="max-w-3xl mx-auto mt-8 bg-white rounded-2xl shadow-lg overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="p-6 md:p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Guess the Word</h2>
              <motion.button
                className="text-gray-500 hover:text-green-500 transition-colors"
                whileHover={{ scale: 1.1, rotate: 5 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowInstructions(true)}
              >
                <Info size={24} />
              </motion.button>
            </div>

            {/* Game Input Form */}
            <form onSubmit={handleSubmit} className="mb-8">
              <div className="flex space-x-2">
                <motion.div className="flex-grow relative" whileFocus={{ scale: 1.02 }}>
                  <input
                    ref={inputRef}
                    type="text"
                    value={guess}
                    onChange={(e) => setGuess(e.target.value)}
                    placeholder="Enter your guess..."
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-green-400 focus:outline-none transition-colors text-lg"
                    autoComplete="off"
                  />
                </motion.div>
                <motion.button
                  type="submit"
                  className="bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-3 rounded-xl font-medium flex items-center justify-center"
                  whileHover={{ scale: 1.05, boxShadow: "0px 5px 15px rgba(0, 0, 0, 0.1)" }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Send size={20} className="mr-2" />
                  Submit
                </motion.button>
              </div>
            </form>

            {/* Feedback Message */}
            <AnimatePresence>
              {feedback && (
                <motion.div
                  className={`mb-6 p-4 rounded-lg ${
                    feedback.type === "success"
                      ? "bg-green-100 text-green-700"
                      : feedback.type === "error"
                        ? "bg-red-100 text-red-700"
                        : "bg-blue-100 text-blue-700"
                  }`}
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {feedback.message}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Celebration Animation */}
            <AnimatePresence>
              {showCelebration && (
                <motion.div
                  className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.div
                    className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-white px-8 py-6 rounded-2xl shadow-lg text-center"
                    initial={{ scale: 0.5, y: 50 }}
                    animate={{
                      scale: [0.5, 1.2, 1],
                      y: [50, -20, 0],
                      rotate: [0, -5, 5, 0],
                    }}
                    transition={{
                      duration: 0.8,
                      times: [0, 0.6, 1],
                      ease: "easeOut",
                    }}
                  >
                    <div className="flex items-center justify-center mb-2">
                      <Trophy className="text-yellow-200 h-8 w-8 mr-2" />
                      <span className="text-xl font-bold">Amazing!</span>
                    </div>
                    <p className="text-yellow-100">&quot;{celebrationWord}&quot; is in the top 100!</p>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Closeness Visualization */}
            <div className="mb-8" id="how-it-works">
              <h3 className="text-lg font-semibold mb-4 text-gray-700">How close are you?</h3>
              <div className="bg-gray-100 p-6 rounded-xl">
                {guesses.length > 0 ? (
                  <div>
                    {/* Most recent guess section */}
                    {guesses
                      .filter((item) => item.order === guessCount)
                      .map((item, index) => (
                        <div key={`latest-${index}`}>
                          <div className="flex items-center mb-2">
                            <div className="bg-blue-500 h-5 w-5 rounded-full mr-2 flex items-center justify-center">
                              <span className="text-white text-xs font-bold">!</span>
                            </div>
                            <h4 className="font-medium text-blue-600">Your latest guess</h4>
                          </div>
                          {item.isTop1000 ? (
                            // TOP 1000 GUESS - GOLD STYLING
                            <motion.div
                              className="relative overflow-hidden mb-4"
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ duration: 0.4 }}
                            >
                              {/* Gold background with sparkle effect */}
                              <div className="absolute inset-0 bg-gradient-to-r from-yellow-300 via-yellow-400 to-yellow-300 opacity-80 rounded-xl"></div>

                              {/* Sparkle animations */}
                              <div className="absolute inset-0 overflow-hidden">
                                {[...Array(5)].map((_, i) => (
                                  <motion.div
                                    key={i}
                                    className="absolute w-2 h-2 bg-white rounded-full"
                                    initial={{
                                      x: Math.random() * 100 + "%",
                                      y: Math.random() * 100 + "%",
                                      opacity: 0,
                                    }}
                                    animate={{
                                      opacity: [0, 1, 0],
                                      scale: [0, 1, 0],
                                    }}
                                    transition={{
                                      repeat: Number.POSITIVE_INFINITY,
                                      duration: 1.5,
                                      delay: Math.random() * 2,
                                      repeatDelay: Math.random() * 3,
                                    }}
                                  />
                                ))}
                              </div>

                              {/* Content */}
                              <div className="relative p-4 rounded-xl border-2 border-blue-500 shadow-md flex items-center">
                                <div className="flex-shrink-0 mr-3">
                                  <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center">
                                    {getRankIcon(item.scoreDisplay)}
                                  </div>
                                </div>
                                <div className="flex-grow">
                                  <div className="font-bold text-yellow-900 text-lg">{item.word}</div>
                                  <div className="flex items-center">
                                    <div className="h-3 bg-yellow-200 rounded-full overflow-hidden flex-grow mr-3">
                                      <motion.div
                                        className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400"
                                        initial={{ width: 0 }}
                                        animate={{
                                          width: `${((1000 - Number.parseInt(item.scoreDisplay)) / 1000) * 100}%`,
                                        }}
                                        transition={{ duration: 0.8, ease: "easeOut" }}
                                      />
                                    </div>
                                    <div className="font-bold text-yellow-800 text-right">{item.scoreDisplay}</div>
                                  </div>
                                </div>
                                <div className="ml-4 text-xs text-yellow-800 bg-yellow-200 px-2 py-1 rounded-full">
                                  #{item.order}
                                </div>
                              </div>
                            </motion.div>
                          ) : (
                            // REGULAR GUESS - TEMPERATURE STYLING
                            <motion.div
                              className="relative flex items-center space-x-4 p-3 rounded-lg bg-white shadow-sm border-2 border-blue-400 mb-4"
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.3 }}
                            >
                              <div className="text-2xl w-10 flex justify-center">
                                {getTemperatureEmoji(item.progressPercent)}
                              </div>
                              <div className="font-medium flex-grow">{item.word}</div>
                              <div className="flex-grow">
                                <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                                  <motion.div
                                    className={`h-full ${
                                      item.progressPercent >= 80
                                        ? "bg-gradient-to-r from-red-500 to-orange-500"
                                        : item.progressPercent >= 60
                                          ? "bg-gradient-to-r from-orange-500 to-yellow-500"
                                          : item.progressPercent >= 40
                                            ? "bg-gradient-to-r from-yellow-500 to-green-500"
                                            : item.progressPercent >= 20
                                              ? "bg-gradient-to-r from-green-500 to-blue-500"
                                              : "bg-gradient-to-r from-blue-500 to-indigo-500"
                                    }`}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${item.progressPercent}%` }}
                                    transition={{ duration: 0.8, ease: "easeOut" }}
                                  />
                                </div>
                              </div>
                              <div className="font-bold text-gray-700 w-16 text-right">{item.scoreDisplay}</div>
                              <div className="text-xs text-gray-500 w-8 text-center">#{item.order}</div>
                            </motion.div>
                          )}
                        </div>
                      ))}

                    {/* Divider */}
                    <div className="flex items-center my-4">
                      <div className="flex-grow h-px bg-gray-300"></div>
                      <div className="mx-4 text-sm text-gray-500 font-medium">Previous Guesses</div>
                      <div className="flex-grow h-px bg-gray-300"></div>
                    </div>

                    {/* Previous guesses sorted by closeness */}
                    <div className="space-y-4">
                      {sortGuessesByCloseness(
                        guesses.filter((item) => item.order !== guessCount),
                        guessCount,
                      ).map((item, index) =>
                        item.isTop1000 ? (
                          // TOP 1000 HISTORY ITEM
                          <motion.div
                            key={index}
                            className="p-2 rounded-lg bg-gradient-to-r from-yellow-100 to-yellow-200 border-2 border-yellow-300 shadow-sm flex items-center"
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: index * 0.05 }}
                          >
                            <div className="text-sm font-medium w-8 text-center text-yellow-800">#{item.order}</div>
                            <div className="font-medium flex-grow flex items-center text-yellow-900">
                              {item.word}
                              <motion.span
                                className="ml-2"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.3, type: "spring" }}
                              >
                                {getRankIcon(item.scoreDisplay)}
                              </motion.span>
                            </div>
                            <div className="font-bold text-yellow-800 bg-yellow-50 px-2 py-1 rounded-full">
                              {item.scoreDisplay}
                            </div>
                          </motion.div>
                        ) : (
                          // REGULAR HISTORY ITEM
                          <motion.div
                            key={index}
                            className="flex items-center space-x-4 p-2 rounded-lg bg-white shadow-sm border border-gray-200"
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: index * 0.05 }}
                          >
                            <div className="text-sm font-medium w-8 text-center">#{item.order}</div>
                            <div className="text-lg mr-1">{getTemperatureEmoji(item.progressPercent)}</div>
                            <div className="font-medium flex-grow">{item.word}</div>
                            <div
                              className={`font-bold ${
                                item.progressPercent >= 80
                                  ? "text-red-600"
                                  : item.progressPercent >= 60
                                    ? "text-orange-600"
                                    : item.progressPercent >= 40
                                      ? "text-yellow-600"
                                      : item.progressPercent >= 20
                                        ? "text-green-600"
                                        : "text-blue-600"
                              }`}
                            >
                              {item.scoreDisplay}
                            </div>
                          </motion.div>
                        )
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    Your guesses will appear here. The closer you are to the target word, the higher your score!
                  </div>
                )}
              </div>
            </div>

            {/* Guess History */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4 text-gray-700">Guess History</h3>
              <div className="bg-gray-100 p-6 rounded-xl max-h-60 overflow-y-auto">
                {guesses.length > 0 ? (
                  <div className="space-y-2">
                    {/* Most recent guess first */}
                    {guesses
                      .filter((item) => item.order === guessCount)
                      .map((item, index) =>
                        item.isTop1000 ? (
                          // TOP 1000 HISTORY ITEM
                          <motion.div
                            key={`latest-${index}`}
                            className="relative p-2 rounded-lg bg-gradient-to-r from-yellow-100 to-yellow-200 border-2 border-blue-400 shadow-sm flex items-center"
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                          >
                            <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                              Latest
                            </div>
                            <div className="text-sm font-medium w-8 text-center text-yellow-800">#{item.order}</div>
                            <div className="font-medium flex-grow flex items-center text-yellow-900">
                              {item.word}
                              <motion.span
                                className="ml-2"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.3, type: "spring" }}
                              >
                                {getRankIcon(item.scoreDisplay)}
                              </motion.span>
                            </div>
                            <div className="font-bold text-yellow-800 bg-yellow-50 px-2 py-1 rounded-full">
                              {item.scoreDisplay}
                            </div>
                          </motion.div>
                        ) : (
                          // REGULAR HISTORY ITEM
                          <motion.div
                            key={`latest-${index}`}
                            className="relative flex items-center space-x-4 p-2 rounded-lg bg-white shadow-sm border-2 border-blue-400"
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                          >
                            <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                              Latest
                            </div>
                            <div className="text-sm font-medium w-8 text-center">#{item.order}</div>
                            <div className="text-lg mr-1">{getTemperatureEmoji(item.progressPercent)}</div>
                            <div className="font-medium flex-grow">{item.word}</div>
                            <div
                              className={`font-bold ${
                                item.progressPercent >= 80
                                  ? "text-red-600"
                                  : item.progressPercent >= 60
                                    ? "text-orange-600"
                                    : item.progressPercent >= 40
                                      ? "text-yellow-600"
                                      : item.progressPercent >= 20
                                        ? "text-green-600"
                                        : "text-blue-600"
                              }`}
                            >
                              {item.scoreDisplay}
                            </div>
                          </motion.div>
                        )
                      )}

                    {/* Divider if there's a latest guess */}
                    {guesses.some((item) => item.order === guessCount) && (
                      <div className="flex items-center my-2">
                        <div className="flex-grow h-px bg-gray-300"></div>
                        <div className="mx-4 text-xs text-gray-500">Previous Guesses</div>
                        <div className="flex-grow h-px bg-gray-300"></div>
                      </div>
                    )}

                    {/* Previous guesses sorted by closeness */}
                    {sortGuessesByCloseness(
                      guesses.filter((item) => item.order !== guessCount),
                      guessCount,
                    ).map((item, index) =>
                      item.isTop1000 ? (
                        // TOP 1000 HISTORY ITEM
                        <motion.div
                          key={index}
                          className="p-2 rounded-lg bg-gradient-to-r from-yellow-100 to-yellow-200 border-2 border-yellow-300 shadow-sm flex items-center"
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.05 }}
                        >
                          <div className="text-sm font-medium w-8 text-center text-yellow-800">#{item.order}</div>
                          <div className="font-medium flex-grow flex items-center text-yellow-900">
                            {item.word}
                            <motion.span
                              className="ml-2"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ delay: 0.3, type: "spring" }}
                            >
                              {getRankIcon(item.scoreDisplay)}
                            </motion.span>
                          </div>
                          <div className="font-bold text-yellow-800 bg-yellow-50 px-2 py-1 rounded-full">
                            {item.scoreDisplay}
                          </div>
                        </motion.div>
                      ) : (
                        // REGULAR HISTORY ITEM
                        <motion.div
                          key={index}
                          className="flex items-center space-x-4 p-2 rounded-lg bg-white shadow-sm border border-gray-200"
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.05 }}
                        >
                          <div className="text-sm font-medium w-8 text-center">#{item.order}</div>
                          <div className="text-lg mr-1">{getTemperatureEmoji(item.progressPercent)}</div>
                          <div className="font-medium flex-grow">{item.word}</div>
                          <div
                            className={`font-bold ${
                              item.progressPercent >= 80
                                ? "text-red-600"
                                : item.progressPercent >= 60
                                  ? "text-orange-600"
                                  : item.progressPercent >= 40
                                    ? "text-yellow-600"
                                    : item.progressPercent >= 20
                                      ? "text-green-600"
                                      : "text-blue-600"
                            }`}
                          >
                            {item.scoreDisplay}
                          </div>
                        </motion.div>
                      )
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    Your guess history will appear here in the order you made them.
                  </div>
                )}
              </div>
            </div>

            {/* Game Info */}
            <div className="bg-blue-50 rounded-xl p-6" id="about">
              <div className="flex items-start space-x-4">
                <div className="bg-blue-100 p-2 rounded-full">
                  <BookOpen size={24} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-blue-800 mb-2">About the Game</h3>
                  <p className="text-blue-700">
                    PPmantle is a semantic word-guessing game. Try to guess the secret word by entering related words.
                    The closer your guess is semantically to the target word, the higher your score!
                  </p>
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="mt-8 bg-gray-50 rounded-xl p-6 border border-gray-200">
              <h3 className="text-lg font-semibold mb-4 text-gray-700">Legend</h3>

              {/* Top 1000 */}
              <div className="mb-4">
                <div className="flex items-center mb-2">
                  <div className="w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center mr-2">
                    <Trophy className="text-yellow-800 w-4 h-4" />
                  </div>
                  <span className="font-bold text-yellow-800">Top 1000 Words</span>
                </div>
                <div className="p-2 bg-gradient-to-r from-yellow-100 to-yellow-200 border-2 border-yellow-300 rounded-lg text-sm text-yellow-800">
                  Words in the top 1000 are highlighted with gold and show their exact ranking
                </div>
              </div>

              {/* Temperature Scale */}
              <div>
                <div className="font-bold mb-2">Temperature Scale</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="flex items-center p-2 bg-white rounded-lg border border-gray-200">
                    <span className="text-xl mr-2">🔥</span>
                    <span>Very Hot (80-100)</span>
                  </div>
                  <div className="flex items-center p-2 bg-white rounded-lg border border-gray-200">
                    <span className="text-xl mr-2">🌶️</span>
                    <span>Hot (60-79)</span>
                  </div>
                  <div className="flex items-center p-2 bg-white rounded-lg border border-gray-200">
                    <span className="text-xl mr-2">☀️</span>
                    <span>Warm (40-59)</span>
                  </div>
                  <div className="flex items-center p-2 bg-white rounded-lg border border-gray-200">
                    <span className="text-xl mr-2">❄️</span>
                    <span>Cold (20-39)</span>
                  </div>
                  <div className="flex items-center p-2 bg-white rounded-lg border border-gray-200">
                    <span className="text-xl mr-2">🧊</span>
                    <span>Very Cold (0-19)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-6 mt-auto">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-500 text-sm mb-4 md:mb-0">
              © {new Date().getFullYear()} PPmantle. All rights reserved.
            </p>
            <div className="flex space-x-4">
              {[
                { icon: <Github size={20} />, label: "GitHub" },
                { icon: <Twitter size={20} />, label: "Twitter" },
                { icon: <Linkedin size={20} />, label: "LinkedIn" },
              ].map((social, index) => (
                <motion.a
                  key={index}
                  href="#"
                  className="text-gray-400 hover:text-green-500 transition-colors"
                  whileHover={{ scale: 1.2, rotate: 5 }}
                  whileTap={{ scale: 0.9 }}
                  aria-label={social.label}
                >
                  {social.icon}
                </motion.a>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {/* Instructions Modal */}
      <AnimatePresence>
        {showInstructions && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowInstructions(false)}
          >
            <motion.div
              className="bg-white rounded-2xl max-w-md w-full p-6"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-800">How to Play</h3>
                <motion.button
                  onClick={() => setShowInstructions(false)}
                  className="text-gray-400 hover:text-gray-600"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <X size={24} />
                </motion.button>
              </div>

              <div className="space-y-4 text-gray-600">
                <p>
                  <span className="font-semibold text-gray-700">1.</span> Try to guess the secret word by entering
                  related words.
                </p>
                <p>
                  <span className="font-semibold text-gray-700">2.</span> After each guess, you will see a score showing
                  how semantically close your word is to the target.
                </p>
                <p>
                  <span className="font-semibold text-gray-700">3.</span> A score of 0/1000 means you have found the exact
                  word!
                </p>
                <p>
                  <span className="font-semibold text-gray-700">4.</span> Words in the top 1000 will be highlighted with
                  gold styling and special icons.
                </p>
                <p>
                  <span className="font-semibold text-gray-700">5.</span> For other guesses, temperature emojis show how
                  close you are getting.
                </p>
              </div>

              <motion.button
                className="mt-6 w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-3 rounded-xl font-medium"
                onClick={() => setShowInstructions(false)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                Got it!
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
