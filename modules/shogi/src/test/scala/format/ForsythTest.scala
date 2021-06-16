package shogi
package format

import Forsyth.SituationPlus
import Pos._
import variant._

class ForsythTest extends ShogiTest {

  val f = Forsyth

  "the forsyth notation" should {
    "export" in {
      "game opening" in {
        val moves = List(C3 -> C4, G7 -> G6, B2 -> H8, G9 -> H8)
        "new game" in {
          f >> makeGame must_== "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1"
        }
        "new game board only" in {
          f exportBoard makeBoard must_== "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL"
        }
        "one move" in {
          makeGame.playMoveList(moves take 1) must beSuccess.like { case g =>
            f >> g must_== "lnsgkgsnl/1r5b1/ppppppppp/9/9/2P6/PP1PPPPPP/1B5R1/LNSGKGSNL w - 2"
          }
        }
        "2 moves" in {
          makeGame.playMoveList(moves take 2) must beSuccess.like { case g =>
            f >> g must_== "lnsgkgsnl/1r5b1/pppppp1pp/6p2/9/2P6/PP1PPPPPP/1B5R1/LNSGKGSNL b - 3"
          }
        }
        "3 moves" in {
          makeGame.playMoveList(moves take 3) must beSuccess.like { case g =>
            f >> g must_== "lnsgkgsnl/1r5B1/pppppp1pp/6p2/9/2P6/PP1PPPPPP/7R1/LNSGKGSNL w B 4"
          }
        }
        "4 moves" in {
          makeGame.playMoveList(moves take 4) must beSuccess.like { case g =>
            f >> g must_== "lnsgkg1nl/1r5s1/pppppp1pp/6p2/9/2P6/PP1PPPPPP/7R1/LNSGKGSNL b Bb 5"
          }
        }
        "5 drop" in {
          makeGame.playMoveList(moves take 4) must beSuccess.like { case g =>
            g.playDrop(Bishop, E5) must beSuccess.like { case g2 =>
              f >> g2 must_== "lnsgkg1nl/1r5s1/pppppp1pp/6p2/4B4/2P6/PP1PPPPPP/7R1/LNSGKGSNL w b 6"
            }
          }
        }
      }

    }
    "import" in {
      val moves = List(C3 -> C4, G7 -> G6, B2 -> H8, G9 -> H8)
      def compare(ms: List[(Pos, Pos)], fen: String) =
        makeGame.playMoveList(ms) must beSuccess.like { case g =>
          (f << fen) must beSome.like { case situation =>
            situation.board.visual must_== g.situation.board.visual
          }
        }
      "new game" in {
        compare(
          Nil,
          "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1"
        )
      }
      "one move" in {
        compare(
          moves take 1,
          "lnsgkgsnl/1r5b1/ppppppppp/9/9/2P6/PP1PPPPPP/1B5R1/LNSGKGSNL w - 2"
        )
      }
      "2 moves" in {
        compare(
          moves take 2,
          "lnsgkgsnl/1r5b1/pppppp1pp/6p2/9/2P6/PP1PPPPPP/1B5R1/LNSGKGSNL b - 3"
        )
      }
      "3 moves" in {
        compare(
          moves take 3,
          "lnsgkgsnl/1r5B1/pppppp1pp/6p2/9/2P6/PP1PPPPPP/7R1/LNSGKGSNL w B 4"
        )
      }
      "4 moves" in {
        compare(
          moves take 4,
          "lnsgkg1nl/1r5s1/pppppp1pp/6p2/9/2P6/PP1PPPPPP/7R1/LNSGKGSNL b Bb 5"
        )
      }
      "invalid" in {
        f << "hahaha" must beNone
      }
    }
  }
  "export to situation plus" should {
    "with turns" in {
      "starting" in {
        f <<< "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1" must beSome.like { case s =>
          s.turns must_== 0
        }
      }
      "sente to play" in {
        f <<< "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 11" must beSome.like {
          case s => s.turns must_== 10
        }
      }
      "gote to play" in {
        f <<< "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL w - 2" must beSome.like { case s =>
          s.turns must_== 1
        }
      }
    }
  }
  "pieces in hand" should {
    "read" in {
      "hands" in {
        f <<< "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1" must beSome.like { case s =>
          s.situation.board.crazyData must beSome.like { case d =>
            d must_== Data(Pockets(Pocket(Nil), Pocket(Nil)))
          }
        }
      }
      "winboard pockets" in {
        f <<< "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b PNr 1" must beSome.like {
          case s =>
            s.situation.board.crazyData must beSome.like { case d =>
              d must_== Data(Pockets(Pocket(Pawn :: Knight :: Nil), Pocket(Rook :: Nil)))
            }
        }
      }
    }
  }
}
