import { createBrowserRouter } from "react-router-dom";
import App from "../App";
import ThreeJsCadEditor from "../pages/2DEditor";
import ThreeDEditor from "../pages/3DEditor";
import CADEditor from "../pages/2DEditor";
import SketchApp from "../pages/2DEditor";
import ExtrudeDemo from "../pages/Sample";
import ExtrusionConverter from "../pages/Sample";
const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        path: "2d-editor",
        element: <SketchApp />,
      },
      {
        path: "/",
        element: <ThreeDEditor/>
      },{
        path: "sample",
        element: <ExtrudeDemo />
      }
    ],
  },
]);

export default router;
