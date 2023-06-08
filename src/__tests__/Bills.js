/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom/extend-expect";
import { screen, waitFor } from "@testing-library/dom";
import BillsUI from "../views/BillsUI.js";
import Bills from "../containers/Bills.js";
import { bills } from "../fixtures/bills.js";
import { ROUTES_PATH } from "../constants/routes.js";
import { ROUTES } from "../constants/routes.js";
import { localStorageMock } from "../__mocks__/localStorage.js";
import mockStore from "../__mocks__/store.js";
import router from "../app/Router.js";
import userEvent from "@testing-library/user-event";
import ErrorPage from "../views/ErrorPage.js";

// Simule la modale pour la fonction icon eye
$.fn.modal = jest.fn();

// Ajout du mockstore pour simuler les actions de l'utilisateur et les réponses du serveur (API)
jest.mock("../app/store", () => mockStore);

// On crée un localStorage avant les tests pour simuler un utilisateur connecté
beforeAll(() => {
  Object.defineProperty(window, "localStorage", { value: localStorageMock });
  window.localStorage.setItem(
    "user",
    JSON.stringify({
      type: "Employee",
      email: "employee@test.tld",
      status: "connected",
    })
  );
});

// On vide le localStorage après chaque test
afterEach(() => {
  jest.clearAllMocks();
});

// On crée un test pour vérifier que l'icône de la page est bien sélectionnée
describe("Given I am connected as an employee", () => {
  describe("When I am on Bills Page", () => {
    test("Then bill icon in vertical layout should be highlighted", async () => {
      Object.defineProperty(window, "localStorage", {
        value: localStorageMock,
      });
      window.localStorage.setItem(
        "user",
        JSON.stringify({
          type: "Employee",
        })
      );
      const root = document.createElement("div");
      root.setAttribute("id", "root");
      document.body.append(root);
      router();
      window.onNavigate(ROUTES_PATH.Bills);
      await waitFor(() => screen.getByTestId("icon-window"));
      const windowIcon = screen.getByTestId("icon-window");
      //to-do write expect expression
      expect(windowIcon.classList.contains("active-icon")).toBe(true);
    });
    test("Then bills should be ordered from earliest to latest", () => {
      document.body.innerHTML = BillsUI({ data: bills });
      const dates = screen
        .getAllByText(
          /^(19|20)\d\d[- /.](0[1-9]|1[012])[- /.](0[1-9]|[12][0-9]|3[01])$/i
        )
        .map((a) => a.innerHTML);
      const antiChrono = (a, b) => new Date(b.date) - new Date(a.date);
      const datesSorted = [...dates].sort(antiChrono);
      expect(dates).toEqual(datesSorted);
    });
    describe("When i am calling getBills method", () => {
      test("Then it should return mapped bills with formated date and status", async () => {
        const bills = new Bills({
          document,
          onNavigate,
          store: mockStore,
          localStorage,
        });
        const formatedBills = await bills.getBills();

        expect(formatedBills[0].date).toBe("4 Avr. 04");
        expect(formatedBills[0].status).toBe("En attente");
      });

      test("Then it should return mapped bills with formated status and untouched date", async () => {
        const resolvedBillsListValueWithWrongDate = [
          {
            id: "43225ddsf6fIm2zOKkLzMro",
            status: "pending",
            date: "wrong_date_example",
          },
        ];

        // On espionne la méthode `list()` du magasin de l'application pour simuler l'appel à l'API avec une date incorrecte
        jest
          .spyOn(mockStore.bills(), "list")
          .mockResolvedValueOnce(resolvedBillsListValueWithWrongDate);

        const bills = new Bills({
          document,
          onNavigate,
          store: mockStore,
          localStorage,
        });
        const formatedBills = await bills.getBills();

        expect(mockStore.bills().list).toBeCalled();
        expect(formatedBills[0].date).toBe("wrong_date_example");
        expect(formatedBills[0].status).toBe("En attente");
      });
    });

    describe("When I click on the icon eye", () => {
      test("Then a modal should open", async () => {
        const onNavigate = (pathname) => {
          document.body.innerHTML = ROUTES({ pathname });
        };

        new Bills({ document, onNavigate, store: mockStore, localStorage });

        // On récupère tous les boutons de l'interface qui ont la classe `icon-eye`

        const eyesIcons = screen.getAllByTestId("icon-eye");
        const firstEyesIcon = eyesIcons[0];

        userEvent.click(firstEyesIcon);

        // On attend que la modale soit affichée à l'écran

        const dialog = await screen.findByRole("dialog", { hidden: true });
        expect(dialog).toBeVisible();
      });
    });

    // On crée un test pour vérifier que les données des factures sont correctement affichées dans l'interface utilisateur.
    describe("When bills are being fetched from Api", () => {
      // On espionne la méthode `list()` du magasin de l'application pour simuler l'appel à l'API
      beforeAll(() => {
        jest.spyOn(mockStore.bills(), "list");
      });

      // On initialise l'état de l'application avant chaque test.
      beforeEach(() => {
        localStorage.setItem(
          "user",
          JSON.stringify({ type: "Employee", email: "a@a" })
        );
        const root = '<div id="root"></div>';
        document.body.innerHTML = root;
        router();
      });

      // On teste que les données des factures sont correctement affichées dans l'interface utilisateur.
      test("Then bills data should be returned and displayed", async () => {
        window.onNavigate(ROUTES_PATH.Bills);
        await waitFor(() => {
          expect(mockStore.bills().list).toHaveBeenCalled();
          expect(document.querySelectorAll("tbody tr").length).toBe(4);

          expect(screen.getByText("encore")).toBeTruthy();
          expect(screen.getByText("test1")).toBeTruthy();
          expect(screen.getByText("test2")).toBeTruthy();
          expect(screen.getByText("test3")).toBeTruthy();
        });
      });

      // On teste en cas d'erreur avec l'api
      describe("When an error occurs on api", () => {
        // On regarde si une erreur 500 est correctement gérée.
        test("Then fetch should fail with a 500 message error displayed to the DOM", async () => {
          const authErrorMock = new Error("Erreur 500");
          jest
            .spyOn(mockStore.bills(), "list")
            .mockRejectedValueOnce(authErrorMock);

          window.onNavigate(ROUTES_PATH.Bills);

          await waitFor(() => {
            expect(screen.getByText(/Erreur 500/)).toBeTruthy();
            expect(document.body).toMatchSnapshot(ErrorPage(authErrorMock));
          });
        });

        // On regarde si une erreur 401 est correctement gérée.
        test("Then fetch should fail with a 401 message error displayed to the DOM", async () => {
          const authErrorMock = new Error("Erreur 401");
          jest
            .spyOn(mockStore.bills(), "list")
            .mockRejectedValueOnce(authErrorMock);

          window.onNavigate(ROUTES_PATH.Bills);

          await waitFor(() => {
            expect(screen.getByText(/Erreur 401/)).toBeTruthy();
            expect(document.body).toMatchSnapshot(ErrorPage(authErrorMock));
          });
        });

        // On regarde si une erreur 404 est correctement gérée.
        test("Then fetch should fail with a 404 message error displayed to the DOM", async () => {
          const authErrorMock = new Error("Erreur 404");
          jest
            .spyOn(mockStore.bills(), "list")
            .mockRejectedValueOnce(authErrorMock);

          window.onNavigate(ROUTES_PATH.Bills);

          await waitFor(() => {
            expect(screen.getByText(/Erreur 404/)).toBeTruthy();
            expect(document.body).toMatchSnapshot(ErrorPage(authErrorMock));
          });
        });
      });
    });
  });
});
